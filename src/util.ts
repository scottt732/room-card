import { HomeAssistant } from 'custom-card-helpers';
import { html, PropertyValues } from 'lit';
import { HassEntity } from 'home-assistant-js-websocket';
import { UNAVAILABLE_STATES, LAST_UPDATED } from './lib/constants';
import { HomeAssistantEntity, RoomCardConfig, RoomCardEntity, EntityCondition, RoomCardLovelaceCardConfig, RoomCardRow, RoomCardIcon, HideIfConfig } from './types/room-card-types';
import { mapTemplate } from './template';

export const isObject = (obj: unknown) : boolean => typeof obj === 'object' && !Array.isArray(obj) && !!obj;

export const isUnavailable = (stateObj: HomeAssistantEntity) : boolean => !stateObj || UNAVAILABLE_STATES.includes(stateObj.state);

export const getValue = (entity: RoomCardEntity) => {
    if(entity.attribute && entity.stateObj.attributes[entity.attribute] === undefined) {
        throw new Error(`Entity: '${entity.entity}' has no attribute named '${entity.attribute}'`);
    }

    return entity.attribute ? entity.stateObj.attributes[entity.attribute] : entity.stateObj.state;
}

export const getEntityIds = (config: RoomCardConfig): string[] => {
    const result = new Set<string>();
    result.add(config.entity);
    config.entities?.forEach((entity) => result.add(getEntity(entity)));
    config.info_entities?.forEach((entity) => result.add(getEntity(entity)));
    config.rows?.flatMap((row) => row.entities).forEach((entity) => result.add(getEntity(entity)));
    config.cards?.flatMap((card) => getCardEntities(card)).forEach((entity) => result.add(entity));
    getConditionEntitiesFromConfig(config).forEach((entity) => result.add(entity));
    return Array.from(result);
}

export const getEntity = (entity?: string | RoomCardEntity) : string => {
    if (entity === undefined) {
        return null;
    } else if (typeof entity === 'string') {
        return entity;
    } else if ('entities' in entity) {
        console.log('boop');
    } else if (entity.entity) {
        return entity.entity;
    }
}

export const getConditionEntities = (entities?: RoomCardEntity[]) : EntityCondition[] => {
    let conditions: EntityCondition[] = [];
    entities?.forEach(entity => {
        const iconConditionsWithEntity = (entity?.icon as RoomCardIcon)?.conditions?.filter(x => x.entity !== undefined);
        if(iconConditionsWithEntity) {
            conditions = conditions.concat(iconConditionsWithEntity);
        }
        const hideConditionsWithEntity = (entity?.hide_if as HideIfConfig)?.conditions?.filter(x => x.entity !== undefined);
        if(hideConditionsWithEntity) {
            conditions = conditions.concat(hideConditionsWithEntity);
        }
    });

    return conditions;
}

export const getConditionEntitiesFromConfig = (config: RoomCardConfig) : string[] => {
    const entities = [config.entities, config.info_entities, config.rows?.flatMap(row => row.entities)]
    const conditionWithEntities = getConditionEntities(entities.flatMap(entities => entities));

    return conditionWithEntities.filter(condition => condition.entity).map(condition => condition.entity);
}

export const getCardEntities = (card: RoomCardLovelaceCardConfig) : string[] => {
    return [getEntity(card.entity)]
        .concat(card.cards?.flatMap((card) => getCardEntities(card)))
        .concat(card.entities?.flatMap((entity) => getEntity(entity as RoomCardEntity)))
        .filter((entity) => entity);
}

export const checkConditionalValue = (item: EntityCondition, checkValue: unknown) => {
    const itemValue = typeof item.value === 'boolean' ? String(item.value) : item.value;
    if(item.condition == 'equals' && checkValue == itemValue) {
        return true;
    }
    if(item.condition == 'not_equals' && checkValue != itemValue) {
        return true;
    }
    if(item.condition == 'above' && checkValue > itemValue) {
        return true;
    }
    if(item.condition == 'below' && checkValue < itemValue) {
        return true;
    }
}

export const mapStateObject = (entity: RoomCardEntity | string, hass: HomeAssistant, config: RoomCardConfig) : RoomCardEntity => {        
    let conf = typeof entity === 'string' ? { entity: entity } : entity;

    conf = mapTemplate(conf as RoomCardEntity, config);

    return { ...conf, stateObj: hass.states[conf.entity] };
}

// eslint-disable-next-line @typescript-eslint/ban-types
export const evalTemplate = (hass: HomeAssistant | undefined, state: HassEntity, func: string): Function => {
    /* eslint no-new-func: 0 */
    try {
        return new Function('states', 'entity', 'user', 'hass', 'html', `'use strict'; ${func}`).call(
            this,
            hass?.states,
            state,
            hass?.user,
            hass,
            html,
        );
    } catch (e) {
        const funcTrimmed = func.length <= 100 ? func.trim() : `${func.trim().substring(0, 98)}...`;
        e.message = `${e.name}: ${e.message} in '${funcTrimmed}'`;
        e.name = 'RoomCardJSTemplateError';
        throw e;
    }
  }

export const renderClasses = (config: RoomCardConfig | RoomCardRow, classes?: string): string => {
    return `entities-row ${config.content_alignment ? `content-${config.content_alignment}` : 'content-left'}${classes !== undefined ? ` ${classes}` : '' }`;
}