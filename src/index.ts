import { CSSResult, html, LitElement, PropertyValues, TemplateResult } from 'lit';
import { property, customElement } from 'lit/decorators.js';
import { HomeAssistant, LovelaceCard, LovelaceCardConfig } from 'custom-card-helpers';

import { checkConfig, entityStyles, renderEntitiesRow, renderInfoEntity, renderRows, renderTitle } from './entity';
import { getEntityIds, mapStateObject } from './util';
import { hideIfCard } from './hide';
import { style } from './styles';
import { HomeAssistantEntity, RoomCardConfig, RoomCardEntity, RoomCardLovelaceCardConfig, RoomCardRow } from './types/room-card-types';
import * as packageJson from '../package.json';

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
    @property() _hass?: HomeAssistant;
    @property() config?: RoomCardConfig;

    private static zeroDate = '0000-00-00T00:00:00.000Z';

    private entity: RoomCardEntity | undefined;
    private info_entities: RoomCardEntity[] = [];
    private entities: RoomCardEntity[] = [];
    private rows: RoomCardRow[] = [];
    private stateObj: HomeAssistantEntity | undefined;

    private _refCards: LovelaceCard[] = [];
    private _lastChanged = RoomCard.zeroDate;
    private _created = false;
    private _ready = false;
    private _helpers: { createCardElement(config: LovelaceCardConfig): LovelaceCard }

    *walk(cards: RoomCardLovelaceCardConfig[]): Generator<string> {
        if (!cards) {
            return;
        }

        for (const card of cards) {
            console.log(card);
            yield card.type;
            if (card.cards) {
                yield* this.walk(card.cards);
            }
        }
    }

    async waitForDependentComponents(config: RoomCardConfig) {
        const distinctTypes = new Set<string>();
        for (const type of this.walk(config.cards)) {
            if (type.indexOf('custom:') === 0) {
                distinctTypes.add(type.substring(7, type.length));
            }
        }

        const promises: Promise<CustomElementConstructor>[] = [];
        for (const type of distinctTypes) {
            promises.push(customElements.whenDefined(type));
        }

        await Promise.all(promises);
    }

    async setConfig(config: RoomCardConfig) {
        console.log('setting config');
        checkConfig(config);
        const entityIds = getEntityIds(config);
        this.config = { ...config, entityIds: entityIds };

        this._lastChanged = RoomCard.zeroDate;
        this._ready = false;
        this._created = false;

        await this.waitForDependentComponents(config);

        /* eslint-disable @typescript-eslint/no-explicit-any */
        this._helpers = await (window as any).loadCardHelpers();
        /* eslint-enable @typescript-eslint/no-explicit-any */
        console.log(this._helpers);
        this.createCardElements();
        await this.requestUpdate();

        console.log('all components online');
    }

    set hass(hass: HomeAssistant) {
        this._hass = hass;
    }

    private getMaxIsoSortable(arr: string[][]): string[] {
        if (!arr) {
          return null;
        }
        let maxHolder = arr[0][0];
        let maxV = arr[0][1];
        for (let i = 0; i < arr.length; i++) {
            const a = arr[i];
            if (a[1] > maxV) {
                maxHolder = a[0];
                maxV = a[1];
            }
        }
        return [maxHolder, maxV];
      }

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        if (!this._created) {
            console.log('not ready');
            return false;
        }

        const wasReady = this._ready;
        this._ready = true;

        const maxLastChanged = this.getMaxIsoSortable(
            this.config.entityIds.map((entityId: string) => {
                const state = this._hass.states[entityId];
                if (typeof state === 'undefined') {
                    return [entityId, RoomCard.zeroDate];
                } else {
                    const latest = this.getMaxIsoSortable([[entityId, state.last_changed], [entityId, state.last_updated]])[1];
                    return [entityId, latest];
                }
            })
        );

        const detectedChanges = maxLastChanged[1] > this._lastChanged;
        
        if (detectedChanges) { 
            this._lastChanged = maxLastChanged[1];
            console.log('changes detected via ', maxLastChanged[0]);            
            return true;
        } else if (changedProps.has('config')) {
            console.log('config changed');
            return true;
        } else if (!wasReady) {
            console.log('default update');
            return true;
        } else {
            return false;
        }
    }

    static get styles(): CSSResult {
        return style;
    }
    
    render() : TemplateResult<1> {
        console.log('rendering');

        // TODO: This is heavy. Re-renders all cards. Any way to be more precise?
        this._refCards = this.config.cards?.map((card) => this.createCardElement(card, this._hass))

        for (const c of this._refCards) {
            console.log(c);
        }
        return html`<ha-card elevation="2" style="${entityStyles(this.config.card_styles, this.stateObj, this._hass)}">
                <div class="card-header">
                    ${renderTitle(this.config, this._hass, this, this.entity)}
                    <div class="entities-info-row">
                        ${this.info_entities.map((entity) => renderInfoEntity(entity, this._hass, this))}
                    </div>
                </div>
                ${this.rows !== undefined && this.rows.length > 0 ? 
                    renderRows(this.rows, this._hass, this) : 
                    renderEntitiesRow(this.config, this.entities, this._hass, this)}
                ${this._refCards}
            </ha-card>`;
    }

    getCardSize() {
        const numberOfCards = this.config.cards ? this.config.cards.length : 0;
        const numberOfRows = this.config.rows ? this.config.rows.length : 0;
        const mainSize = !this.config.info_entities && this.config.hide_title ? 1 : 2;

        return numberOfCards + numberOfRows + (this.config.entities ? this.config.entities.length > 0 ? 1 : 0 : 0) + mainSize;
    }

    createCardElements() {
        console.log('creating');

        this.config.hass = this._hass;
        this.stateObj = this.config.entity !== undefined ? this._hass.states[this.config.entity] : undefined;
        this.entity = this.config.entity !== undefined ? { ...this.config, stateObj: this.stateObj } : undefined;
        this.info_entities = this.config.info_entities?.map(entity => mapStateObject(entity, this._hass, this.config)) ?? [];
        this.entities = this.config.entities?.map(entity => mapStateObject(entity, this._hass, this.config)) ?? [];
        this.rows =
            this.config.rows?.map((row) => {
                const rowEntities = row.entities?.map(entity => mapStateObject(entity, this._hass, this.config));
                return { entities: rowEntities, hide_if: row.hide_if, content_alignment: row.content_alignment };
            }) ?? [];

        this._refCards = this.config.cards?.map((card) => this.createCardElement(card, this._hass))

        this._created = true;
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
