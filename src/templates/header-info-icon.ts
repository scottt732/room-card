import { HassEntity } from 'home-assistant-js-websocket/dist/types';
import { HomeAssistant } from "custom-card-helpers";
import { CSSResult, LitElement, PropertyValues, css, html } from "lit";
import { EntityCondition, RoomCardConfig } from "../types/room-card-types";
import { customElement, property } from "lit/decorators.js";
import { entityIcon, entityStyles } from "../entity";
import { templateStyling } from "../template";
import { isObject } from "../util";

@customElement('header-info-icon')
export default class HeaderInfoIconElement extends LitElement {
    @property() hass: HomeAssistant;
    @property() stateObj?: HassEntity;
    @property() config?: RoomCardConfig;

    protected shouldUpdate(changedProps: PropertyValues): boolean {
        const result = this.hass !== undefined 
            && this.config !== undefined
            && changedProps.size > 0
            && this.stateObj !== undefined;

        return result;
    }

    render() {        
        const showIcon = this.config.showIcon !== undefined ? this.config.showIcon : true;
        if(!showIcon) return null;
    
        const customIcon = entityIcon(this.stateObj, this.hass, this.config.icon);
        const customStyling = templateStyling(this.stateObj, this.hass, this.config.icon);
        
        return html`<state-badge
            class="icon-small${this.getIconClassSuffix()}"
            .stateObj="${this.stateObj}"
            .overrideIcon="${isObject(customIcon) ? (customIcon as EntityCondition).icon : customIcon as string}"
            .stateColor="${this.config.stateColor}"
            style="${customStyling ?? entityStyles(
                isObject(customIcon) 
                    ? (customIcon as EntityCondition).styles 
                    : null, 
                this.stateObj, 
                this.hass)}"></state-badge>`;
    }

    getIconClassSuffix() {
        if (this.config.classes === undefined) {
            return '';
        } else if (typeof this.config.classes === 'string') {
            return ` ${this.config.classes}`
        } else if (Array.isArray(this.config.classes)) {
            return ' ' + this.config.classes.join(' ');
        } else {
            return '';
        }
    }

    static get styles(): CSSResult {
        return css`
        .main-icon {
            vertical-align: baseline;
            font-size: 30px;
        }
        ha-state-icon > ha-svg-icon {
            vertical-align: baseline;
        }
        `;
    }}
