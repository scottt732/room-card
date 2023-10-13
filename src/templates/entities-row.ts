import { ActionHandlerEvent, HomeAssistant, hasAction } from "custom-card-helpers";
import { CSSResult, LitElement, PropertyValues, css, html } from "lit";
import { RoomCardConfig } from "../types/room-card-types";
import { customElement, property } from "lit/decorators.js";
import { clickHandler, entityName, entityStateDisplay, entityStyles, renderIcon } from "../entity";
import { mapStateObject, renderClasses } from "../util";
import { actionHandler } from '../directives/action-handler-directive';
import { hideIfEntity } from '../hide';

@customElement('entities-row')
export default class EntitiesRowElement extends LitElement {
    @property() hass: HomeAssistant;
    @property() config?: RoomCardConfig;

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        const result = this.hass !== undefined
            && this.config !== undefined
            && changedProps.size > 0;

        return result;
    }

    render() {   
        const entities = this.config.entities?.map(entity => mapStateObject(entity, this.hass, this.config)) ?? [];
        return html`<div class="${renderClasses(this.config)}">
            ${entities
                .filter(entity => entity.stateObj !== undefined && !hideIfEntity(entity, this.hass))
                .map((entity) => {
                    const _handleAction = (ev: ActionHandlerEvent): void => {
                        if (this.hass && entity && ev.detail.action) {
                            clickHandler(this, this.hass, entity, ev);
                        }
                    }

                    return html`<div class="entity" style="${entityStyles(entity.styles, this.hass.states[entity.entity], this.hass)}"
                        @action=${_handleAction}
                        .actionHandler=${actionHandler({
                            hasHold: hasAction(entity.hold_action),
                            hasDoubleClick: hasAction(entity.double_tap_action),
                        })}>
                        ${entity.show_name === undefined || entity.show_name ? html`<span>${entityName(entity, this.hass)}</span>` : ''}
                        <div>${renderIcon(entity.stateObj, entity, this.hass)}</div>
                        ${entity.show_state ? html`<span>${entityStateDisplay(this.hass, entity)}</span>` : ''}
                    </div>`
            })}
        </div>`;
    }

    static get styles(): CSSResult {
        return css`
        .entities-row {
            flex-direction: row;
            flex-wrap: wrap;
            display: inline-flex;
            align-items: center;
            padding: 0 20px 10px 20px;
        }
        .entities-row .entity {
            margin-right: 16px;
        }    
        .entities-row .entity:last-of-type,
        .entities-column {
            flex-direction: column;
            display: flex;
            align-items: flex-end;
            justify-content: space-evenly;
        }
        `;
    }
}