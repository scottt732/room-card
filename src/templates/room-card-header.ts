import { CSSResult, LitElement, PropertyValues, css, html} from 'lit';
import { customElement, property} from 'lit/decorators.js';
import { ActionHandlerEvent, HomeAssistant, hasAction } from "custom-card-helpers";
import { RoomCardConfig, RoomCardEntity  } from '../types/room-card-types';
import { clickHandler, entityStateDisplay, entityStyles, renderIcon } from '../entity';
import { getTemplateOrAttribute } from "../template";
import { actionHandler } from "../directives/action-handler-directive";
import { getValue, mapStateObject } from "../util";
import { LAST_CHANGED, LAST_UPDATED, TIMESTAMP_FORMATS } from "../lib/constants";

import './header-info-icon'

@customElement('room-card-header')
export default class RoomCardHeaderElement extends LitElement {
    @property() hass: HomeAssistant;
    @property() config?: RoomCardConfig;

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        const result = this.config !== undefined 
            && this.hass !== undefined 
            && this.hass.states !== undefined
            && this.config.entity in this.hass.states
            && changedProps.size > 0;
        
        return result;
    }

    render() {
        const _handleAction = (ev: ActionHandlerEvent): void => {
            if (ev.detail.action) {
                clickHandler(
                    this,
                    this.hass,
                    { 
                        tap_action: this.config.tap_action,
                        double_tap_action: this.config.double_tap_action,
                        hold_action: this.config.hold_action
                    } as RoomCardEntity, 
                    ev
                );
            }
        }
    
        if(this.config.hide_title === true) return null;
        if (!this.hass?.states || !(this.config.entity in this.hass.states)) return null;

        const hasConfigAction = this.config.tap_action !== undefined || this.config.double_tap_action !== undefined;
        const stateObj = this.hass.states[this.config.entity];
        const title = this.config.entity ? getTemplateOrAttribute(this.config.title, this.hass, stateObj) : '';
        const entity = mapStateObject(this.config.entity, this.hass, this.config);

        return html`<div 
            class="title${(hasConfigAction ? ' clickable' : null)}" 
            @action=${_handleAction}
            .actionHandler=${actionHandler({
                hasHold: hasAction(this.config.hold_action),
                hasDoubleClick: hasAction(this.config.double_tap_action),
            })}>
            <div class="main-state entity"
                style="${entityStyles(this.config.styles, stateObj, this.hass)}">
                    ${this.config.entities?.length === 0 || this.config.icon
                        ? html`<header-info-icon 
                            .hass=${this.hass} 
                            .stateObj=${stateObj} 
                            .config=${this.config}></header-info-icon>`
                        : entity.show_state !== undefined && entity.show_state === false 
                            ? '' 
                            : this.renderValue(entity, this.hass)}
            </div>
            ${title} 
        </div>`;
    }

    renderValue = (entity: RoomCardEntity, hass: HomeAssistant) => {
        if (entity.toggle === true) {
            return html`<ha-entity-toggle .stateObj="${entity.stateObj}" .hass="${hass}"></ha-entity-toggle>`;
        }
    
        if (entity.show_icon === true) {
            return renderIcon(entity.stateObj, entity, hass);
        }
    
        if (entity.attribute && [LAST_CHANGED, LAST_UPDATED].includes(entity.attribute)) {
            return html`<ha-relative-time
                .hass=${hass}
                .datetime=${(entity.attribute === LAST_CHANGED ? entity.stateObj.last_changed : entity.stateObj.last_updated)}
                capitalize
            ></ha-relative-time>`;
        }
        
        if (entity.format && TIMESTAMP_FORMATS.includes(entity.format)) {
            const value = getValue(entity);
            const timestamp = new Date(value);
            if (!(timestamp instanceof Date) || isNaN(timestamp.getTime())) {
                return value;
            }
            return html`<hui-timestamp-display
                .hass=${hass}
                .ts=${timestamp}
                .format=${entity.format}
                capitalize
            ></hui-timestamp-display>`;
        }
        
        return entityStateDisplay(hass, entity);
    }

    static get styles(): CSSResult {
        return css`
        .title {
            min-height: 48px;
        }
        .clickable {
            cursor: pointer;
        }
        .main-state {
            float: left;
            margin-right: 10px;
        }
        `;
    }
}
