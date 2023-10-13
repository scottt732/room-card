import { CSSResult, html, HTMLTemplateResult, LitElement, PropertyValues, TemplateResult } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCard, LovelaceCardConfig } from 'custom-card-helpers';

import { checkConfig, entityStyles, renderEntity } from './entity';
import { getEntityIds, mapStateObject, renderClasses } from './util';
import { hideIfCard, hideIfRow } from './hide';
import { style } from './styles';
import { RoomCardConfig, RoomCardLovelaceCardConfig, RoomCardRow } from './types/room-card-types';
import * as packageJson from '../package.json';
import { HassEntities } from 'home-assistant-js-websocket/dist';

import './templates/room-card-header';
import './templates/entities-row';
import './templates/info-entity';

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
    private _hass?: HomeAssistant;
    @property() monitoredStates?: HassEntities;
    @property() config?: RoomCardConfig;
    @property() _helpers: { createCardElement(config: LovelaceCardConfig): LovelaceCard }

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
        this.config = { ...config, entityIds: entityIds };

        await this.waitForDependentComponents(config);

        /* eslint-disable @typescript-eslint/no-explicit-any */
        this._helpers = await (window as any).loadCardHelpers();
    }

    @property()
    get hass() { return this._hass; }
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
                // console.log(` + ${k}:`,v);
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

        return result;
    }

    static get styles(): CSSResult {
        return style;
    }
    
    render() : TemplateResult<1> {
        const stateObj = this.config.entity !== undefined ? this.monitoredStates[this.config.entity] : undefined;
        const result = html`<ha-card elevation="2" style="${entityStyles(this.config.card_styles, stateObj, this._hass)}">
                <div class="card-header">
                    <room-card-header 
                        .hass=${this.hass} 
                        .config=${this.config}>
                    </room-card-header>
                    <div class="entities-info-row">
                        ${this.config.info_entities.map(e => html`<info-entity 
                            .hass=${this.hass}
                            .config=${this.config}
                            .entity=${e}></info-entity>`)}
                    </div>
                </div>
                ${this.config.entities !== undefined
                    ? html`<entities-row 
                        .hass=${this.hass} 
                        .config=${this.config}
                        .entities=${this.config.entities}></entities-row>`
                    : null}
                ${this.config.rows !== undefined
                    ? this.config.rows
                        .filter(row => !hideIfRow(row, this._hass))
                        .map(row => {
                            const rowEntities = row.entities?.map(entity => mapStateObject(entity, this._hass, this.config));
                            return { entities: rowEntities, hide_if: row.hide_if, content_alignment: row.content_alignment };
                        })
                        .map(row => html`<entities-row 
                            .hass=${this.hass}
                            .config=${row}
                            .entities=${row.entities}></entities-row>`)
                    : null}
                ${this.config.cards
                    ?.map(card => html`<div class="card">
                        ${this.createCardElement(card)}
                    </div>`)}
            </ha-card>`;

        return result;
    }

    renderRows(rows: RoomCardRow[], hass: HomeAssistant, element: LitElement): HTMLTemplateResult { 
        return html`${rows.filter(row => !hideIfRow(row, hass)).map((row) => html`<div class="${renderClasses(row)}">${row.entities.map((entity) => renderEntity(entity, hass, element))}</div>`)}`;
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

    createCardElement(config: RoomCardLovelaceCardConfig) {
        if (hideIfCard(config, this.hass) || (config.show_states && !config.show_states.includes(this.hass.states[config.entity].state))) {
            return;
        }

        const element: LovelaceCard = this._helpers.createCardElement(config);

        element.hass = this.hass;
        element.style.boxShadow = 'none';
        element.style.borderRadius = '0';

        return element;
    }
}
