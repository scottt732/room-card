import { CSSResult, html, LitElement, PropertyValues, TemplateResult } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCard, LovelaceCardConfig } from 'custom-card-helpers';

import { checkConfig, entityStyles, renderEntitiesRow, renderInfoEntity, renderRows, renderTitle } from './entity';
import { getEntityIds, mapStateObject } from './util';
import { hideIfCard } from './hide';
import { style } from './styles';
import { HomeAssistantEntity, RoomCardConfig, RoomCardEntity, RoomCardLovelaceCardConfig, RoomCardRow } from './types/room-card-types';
import * as packageJson from '../package.json';
import { HassEntities, HassEntity } from 'home-assistant-js-websocket/dist/types';

console.info(
    `%c ROOM-CARD %c ${packageJson.version}`,
    'color: cyan; background: black; font-weight: bold;',
    'color: darkblue; background: white; font-weight: bold;'
);

/* eslint-disable @typescript-eslint/no-explicit-any */
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
    type: 'room-card',
    name: 'Room card',
    preview: false,
  description: 'Show multiple entity states, attributes and icons in a single card in Home Assistant\'s Lovelace UI',
});
/* eslint-enable @typescript-eslint/no-explicit-any */

@customElement('room-card')
export default class RoomCard extends LitElement {
    @property({ hasChanged: () => false }) _hass?: HomeAssistant;
    @property() monitoredStates?: HassEntities;
    @property() config?: RoomCardConfig;
    @property() _helpers: { createCardElement(config: LovelaceCardConfig): LovelaceCard }

    private _entityCards: { [key: string]: { card?: LovelaceCard, config: RoomCardLovelaceCardConfig, index: number }[]} = {};

    getChildCustomCardTypes(cards: RoomCardLovelaceCardConfig[], target: Set<string>) {
        if (!cards) return;        

        for (const card of cards) {
            if (card.type.indexOf('custom:') === 0) {
                target.add(card.type.substring(7, card.type.length));
            }
            this.getChildCustomCardTypes(card.cards, target)
        }
    }

    async waitForDependentComponents(config: RoomCardConfig) {
        const distinctTypes = new Set<string>();
        this.getChildCustomCardTypes(config.cards, distinctTypes);        
        await Promise.all(Array.from(distinctTypes).map(type => customElements.whenDefined(type)));
    }

    async setConfig(config: RoomCardConfig) {
        checkConfig(config);
        const entityIds = getEntityIds(config);
        ///const compare = this.findEntityIdsInCard(config.cards)

        this.config = { ...config, entityIds: entityIds };

        await this.waitForDependentComponents(config);

        /* eslint-disable @typescript-eslint/no-explicit-any */
        this._helpers = await (window as any).loadCardHelpers();

        // this._entityCards = {};

        /* eslint-enable @typescript-eslint/no-explicit-any */
        // console.log(this._helpers);
        this.createCardElements();
        // await this.requestUpdate();

        // console.log('all components online');
    }

    set hass(hass: HomeAssistant) {
        let anyUpdates = false;
        const newStates: HassEntities = {};

        if (this.monitoredStates) {
            for (const entityId of this.config.entityIds) {
                if (entityId in hass.states) { 
                    if (entityId in this.monitoredStates) {
                        if (hass.states[entityId].last_updated > this.monitoredStates[entityId].last_updated ||
                            hass.states[entityId].last_changed > this.monitoredStates[entityId].last_changed) {
                            anyUpdates = hass.states[entityId] !== newStates[entityId];
                            newStates[entityId] = hass.states[entityId];
                        }
                    }
                } else {
                    anyUpdates = hass.states[entityId] !== newStates[entityId];
                    newStates[entityId] = hass.states[entityId];
                }
            }     
        } else {
            for (const entityId of this.config.entityIds) {
                if (hass.states[entityId] !== undefined) { 
                    anyUpdates = hass.states[entityId] !== newStates[entityId];
                    newStates[entityId] = hass.states[entityId];
                }
            }    
        }

        if (anyUpdates) {
            for (const [k, v] of Object.entries(newStates)) {
                console.log(` + ${k}:`,v);
            }
            this.monitoredStates = newStates;
        }
        this._hass = hass;
    }

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        const result = this.monitoredStates !== undefined 
            && this.config !== undefined 
            && changedProps.size > 0
            && this._helpers !== undefined
            && this._helpers.createCardElement !== undefined;

        console.log(`should update? ${result}`, changedProps);
        return result;
    }

    static get styles(): CSSResult {
        return style;
    }
    
    render() : TemplateResult<1> {
        const stateObj = this.config.entity !== undefined ? this.monitoredStates[this.config.entity] : undefined;
        const entity = this.config.entity !== undefined ? { ...this.config, stateObj: stateObj } : undefined;
        const info_entities = this.config.info_entities?.map(entity => mapStateObject(entity, this._hass, this.config)) ?? [];
        const entities = this.config.entities?.map(entity => mapStateObject(entity, this._hass, this.config)) ?? [];
        const rows =
            this.config.rows?.map((row) => {
                const rowEntities = row.entities?.map(entity => mapStateObject(entity, this._hass, this.config));
                return { entities: rowEntities, hide_if: row.hide_if, content_alignment: row.content_alignment };
            }) ?? [];

        this.createCardElements();        
        
        Object.entries(this._entityCards).flatMap(([,value]) => value).forEach(v => {
            console.log(v.config)
        });
        const result = html`<ha-card elevation="2" style="${entityStyles(this.config.card_styles, stateObj, this._hass)}">
                <div class="card-header">
                    ${renderTitle(this.config, this._hass, this, entity)}
                    <div class="entities-info-row">
                        ${info_entities.map(e => renderInfoEntity(e, this._hass, this))}
                    </div>
                </div>
                ${rows.length > 0 ? 
                    renderRows(rows, this._hass, this) : 
                    renderEntitiesRow(this.config, entities, this._hass, this)}
                ${Object.entries(this._entityCards).flatMap(([,value]) => value).map(v => v.card)}
            </ha-card>`;

        return result;
    }

    getCardSize() {
        const numberOfCards = this.config.cards ? this.config.cards.length : 0;
        const numberOfRows = this.config.rows ? this.config.rows.length : 0;
        const mainSize = !this.config.info_entities && this.config.hide_title ? 1 : 2;

        return numberOfCards + numberOfRows + (this.config.entities ? this.config.entities.length > 0 ? 1 : 0 : 0) + mainSize;
    }

    * findVal(object: { [k:string]: unknown }, key: string): Generator<string> {
        for (const [k, value] of Object.entries(object)) {
            if (k === key) {
                yield value as string;
            }
            if (object[k] && typeof object[k] === 'object') {
                yield* this.findVal(object[k] as { [kk: string]: unknown }, key);
            }
        }
    }

    createCardElements() {
        this._entityCards = {};
        if (!this.config.cards) return;

        let i = 0;
        for (const cardConfig of this.config.cards)
        {
            const lovelaceCard = this.createCardElement(cardConfig, this._hass);
            // const entityIds = this.findEntityIdsInCard(cardConfig);

            for (const entityId of this.config.entityIds) {
                if (!(entityId in this._entityCards)) {
                    this._entityCards[entityId] = [];
                }
                this._entityCards[entityId].push({ config: cardConfig, card: lovelaceCard, index: i });
            }

            i++;
        }
    }

    createCardElement(config: RoomCardLovelaceCardConfig, hass: HomeAssistant) {
        if (
            hideIfCard(config, hass) ||
            (config.show_states && !config.show_states.includes(hass.states[config.entity].state))
        ) {
            console.log('skipping');
            return;
        }
        
        const element: LovelaceCard = this._helpers.createCardElement(config);
        element.hass = hass;
        element.style.boxShadow = 'none';
        element.style.borderRadius = '0';

        return element;
    }
}
