import { RequestOptions, URLSearchParams } from '@angular/http';

import { PaginationAction } from '../types/pagination.types';
import { CFStartAction } from '../types/request.types';
import { getActions } from './action.helper';
import { entityFactory, servicePlanVisibilitySchemaKey } from '../helpers/entity-factory';

export class GetServicePlanVisibilities extends CFStartAction implements PaginationAction {
  constructor(
    public endpointGuid: string,
    public paginationKey: string,
    public includeRelations: string[] = [],
    public populateMissing = true
  ) {
    super();
    this.options = new RequestOptions();
    this.options.url = 'service_plan_visibilities';
    this.options.method = 'get';
    this.options.params = new URLSearchParams();
  }
  actions = getActions('Service Plan Visibilities', 'Get all');
  entity = [entityFactory(servicePlanVisibilitySchemaKey)];
  entityKey = servicePlanVisibilitySchemaKey;
  options: RequestOptions;
  initialParams = {
    page: 1,
    'results-per-page': 100,
    'order-direction': 'desc',
    'order-direction-field': 'service_plan_guid',
  };
  flattenPagination = true;
}
