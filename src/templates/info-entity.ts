import { ActionHandlerEvent, HomeAssistant, hasAction } from "custom-card-helpers";
import { LitElement, PropertyValues, css, html } from "lit";
import { RoomCardConfig, RoomCardEntity } from "../types/room-card-types";
import { customElement, property } from "lit/decorators.js";
import { actionHandler } from "../directives/action-handler-directive";
import { clickHandler, entityStyles, renderValue } from "../entity";
import { mapStateObject } from "../util";

@customElement('info-entity')
export default class InfoEntityElement extends LitElement {
    @property() hass: HomeAssistant;
    @property() config?: RoomCardConfig;
    @property() entity?: RoomCardEntity;

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        const result = this.config !== undefined 
            && this.hass !== undefined 
            && this.hass.states !== undefined
            && this.entity !== undefined
            && changedProps.size > 0;

        return result;
    }

    render() {
        const entity = mapStateObject(this.entity, this.hass, this.config);

        const _handleAction = (ev: ActionHandlerEvent) => {
            if (ev.detail.action) {
                clickHandler(this, this.hass, this.entity, ev);
            }
        }
    
        return html`<div 
            class="state entity ${entity.show_icon === true ? 'icon-entity' : ''}" 
            style="${entityStyles(entity.styles, entity.stateObj, this.hass)}" 
            @action=${_handleAction}
            .actionHandler=${actionHandler({
                hasHold: hasAction(entity.hold_action),
                hasDoubleClick: hasAction(entity.double_tap_action),
            })}>
                ${renderValue(entity, this.hass)}
        </div>`;
    }

    static getStyle() {
        return css`
        .entities-info-row {
            flex-direction: row;
            flex-wrap: wrap;
            display: inline-flex;
            justify-content: center;
            align-items: center;
            padding: 0 20px 10px 20px;
            font-size: 12px;
            position: absolute;
            right: 20px;
            top: 15px;
        }
        .entities-info-row .entity {
            margin-right: 16px;
        }
        .entities-info-row .entity.icon-entity {
            margin-right: 0px;
        }
        `;
    }
}