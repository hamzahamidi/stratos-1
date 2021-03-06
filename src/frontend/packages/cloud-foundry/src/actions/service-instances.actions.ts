import { HttpHeaders, HttpParams, HttpRequest } from '@angular/common/http';

import { getActions } from '../../../store/src/actions/action.helper';
import { PaginatedAction } from '../../../store/src/types/pagination.types';
import { ICFAction } from '../../../store/src/types/request.types';
import { cfEntityFactory } from '../cf-entity-factory';
import {
  applicationEntityType,
  organizationEntityType,
  serviceBindingEntityType,
  serviceBindingNoBindingsEntityType,
  serviceEntityType,
  serviceInstancesEntityType,
  serviceInstancesWithSpaceEntityType,
  servicePlanEntityType,
  spaceEntityType,
} from '../cf-entity-types';
import { createEntityRelationKey, EntityInlineParentAction } from '../entity-relations/entity-relations.types';
import { CFStartAction } from './cf-action.types';

export const DELETE_SERVICE_INSTANCE_ACTIONS = getActions('Service Instances', 'Get particular instance');
export const getServiceInstanceRelations = [
  createEntityRelationKey(serviceInstancesEntityType, serviceBindingEntityType),
  createEntityRelationKey(serviceInstancesEntityType, servicePlanEntityType),
  createEntityRelationKey(serviceInstancesEntityType, spaceEntityType),
  createEntityRelationKey(serviceInstancesEntityType, serviceEntityType),
  createEntityRelationKey(spaceEntityType, organizationEntityType),
  createEntityRelationKey(serviceBindingEntityType, applicationEntityType)
];

export class GetServiceInstances
  extends CFStartAction implements PaginatedAction, EntityInlineParentAction {
  constructor(
    public endpointGuid: string,
    public paginationKey: string,
    public includeRelations: string[] = getServiceInstanceRelations,
    public populateMissing = true
  ) {
    super();
    this.options = new HttpRequest(
      'GET',
      'service_instances'
    );
  }
  actions = getActions('Service Instances', 'Get all');
  entity = [cfEntityFactory(serviceInstancesWithSpaceEntityType)];
  entityType = serviceInstancesEntityType;
  schemaKey = serviceInstancesWithSpaceEntityType;
  options: HttpRequest<any>;
  initialParams = {
    page: 1,
    'results-per-page': 100,
    'order-direction': 'asc',
    'order-direction-field': 'creation',
    q: []
  };
  flattenPagination = true;
}

export class GetServiceInstance
  extends CFStartAction implements EntityInlineParentAction {
  constructor(
    public guid: string,
    public endpointGuid: string,
    public includeRelations: string[] = getServiceInstanceRelations,
    public populateMissing = true
  ) {
    super();
    this.options = new HttpRequest(
      'GET',
      `service_instances/${guid}`
    );
  }
  actions = DELETE_SERVICE_INSTANCE_ACTIONS;
  entity = [cfEntityFactory(serviceInstancesWithSpaceEntityType)];
  schemaKey = serviceInstancesWithSpaceEntityType;
  entityType = serviceInstancesEntityType;
  options: HttpRequest<any>;
}

export class DeleteServiceInstance extends CFStartAction implements ICFAction {
  constructor(public endpointGuid: string, public guid: string) {
    super();
    const headers = new HttpHeaders({
      'x-cap-long-running': 'true'
    });
    this.options = new HttpRequest(
      'DELETE',
      `service_instances/${guid}`,
      {
        headers,
        params: new HttpParams({
          fromObject: {
            accepts_incomplete: 'true',
            async: 'false',
            recursive: 'true'
          }
        })
      }
    );
  }
  actions = getActions('Service Instances', 'Delete Service Instance');
  entity = [cfEntityFactory(serviceInstancesEntityType)];
  entityType = serviceInstancesEntityType;
  options: HttpRequest<any>;
  clearPaginationEntityKeys = [serviceBindingEntityType];
  removeEntityOnDelete = true;
}
export class CreateServiceInstance extends CFStartAction implements ICFAction {
  constructor(
    public endpointGuid: string,
    public guid: string,
    public name: string,
    public servicePlanGuid: string,
    public spaceGuid: string,
    public params: object,
    public tags: string[],
    httpMethod = 'POST',
    url = 'service_instances'
  ) {
    super();
    const headers = new HttpHeaders({
      'x-cap-long-running': 'true'
    });
    this.options = new HttpRequest(
      httpMethod,
      url,
      {
        name,
        space_guid: spaceGuid,
        service_plan_guid: servicePlanGuid,
        parameters: params,
        tags
      },
      {
        headers,
        params: new HttpParams(
          {
            fromObject: {
              accepts_incomplete: 'true'
            }
          }
        )
      }
    );
  }
  actions = getActions('Service Instances', 'Create Service Instance');
  entity = [cfEntityFactory(serviceInstancesEntityType)];
  entityType = serviceInstancesEntityType;
  options: HttpRequest<any>;
}

export class UpdateServiceInstance extends CreateServiceInstance {
  static updateServiceInstance = 'Updating-Service-Instance';
  constructor(
    public endpointGuid: string,
    public guid: string,
    public name: string,
    public servicePlanGuid: string,
    public spaceGuid: string,
    public params: object,
    public tags: string[],
  ) {
    super(endpointGuid, guid, name, servicePlanGuid, spaceGuid, params, tags, 'PUT', `service_instances/${guid}`);
    this.actions = getActions('Service Instances', 'Update Service Instance');
  }
  updatingKey = UpdateServiceInstance.updateServiceInstance;
}

export class ListServiceBindingsForInstance
  extends CFStartAction implements PaginatedAction, EntityInlineParentAction {
  constructor(
    public endpointGuid: string,
    public serviceInstanceGuid: string,
    public paginationKey: string,
    public includeRelations: string[] = [
      createEntityRelationKey(serviceBindingEntityType, serviceInstancesEntityType),
      createEntityRelationKey(serviceBindingEntityType, applicationEntityType)
    ],
    public populateMissing = true
  ) {
    super();
    this.options = new HttpRequest(
      'GET',
      `service_instances/${serviceInstanceGuid}/service_bindings`
    );
  }
  actions = getActions('Service Instances', 'Get all service bindings for instance');
  entity = [cfEntityFactory(serviceBindingNoBindingsEntityType)];
  entityType = serviceBindingEntityType;
  options: HttpRequest<any>;
  initialParams = {
    page: 1,
    'results-per-page': 100,
    'order-direction': 'desc',
    'order-direction-field': 'creation',
  };
  flattenPagination = true;
}
