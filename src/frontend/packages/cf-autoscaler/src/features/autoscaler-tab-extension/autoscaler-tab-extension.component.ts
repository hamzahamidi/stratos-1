import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatSnackBar, MatSnackBarRef, SimpleSnackBar } from '@angular/material/snack-bar';
import { ActivatedRoute } from '@angular/router';
import { Store } from '@ngrx/store';
import { combineLatest, Observable, Subscription } from 'rxjs';
import { distinctUntilChanged, filter, first, map, pairwise, publishReplay, refCount } from 'rxjs/operators';

import { applicationEntityType } from '../../../../cloud-foundry/src/cf-entity-types';
import { createEntityRelationPaginationKey } from '../../../../cloud-foundry/src/entity-relations/entity-relations.types';
import { ApplicationMonitorService } from '../../../../cloud-foundry/src/features/applications/application-monitor.service';
import { ApplicationService } from '../../../../cloud-foundry/src/features/applications/application.service';
import { getGuids } from '../../../../cloud-foundry/src/features/applications/application/application-base.component';
import { entityCatalogue } from '../../../../core/src/core/entity-catalogue/entity-catalogue.service';
import { EntityService } from '../../../../core/src/core/entity-service';
import { EntityServiceFactory } from '../../../../core/src/core/entity-service-factory.service';
import { StratosTab, StratosTabType } from '../../../../core/src/core/extension/extension-service';
import { safeUnsubscribe } from '../../../../core/src/core/utils.service';
import { ConfirmationDialogConfig } from '../../../../core/src/shared/components/confirmation-dialog.config';
import { ConfirmationDialogService } from '../../../../core/src/shared/components/confirmation-dialog.service';
import { PaginationMonitorFactory } from '../../../../core/src/shared/monitors/pagination-monitor.factory';
import { RouterNav } from '../../../../store/src/actions/router.actions';
import { AppState } from '../../../../store/src/app-state';
import { ActionState } from '../../../../store/src/reducers/api-request-reducer/types';
import { getPaginationObservables } from '../../../../store/src/reducers/pagination-reducer/pagination-reducer.helper';
import { selectDeletionInfo } from '../../../../store/src/selectors/api.selectors';
import { APIResource } from '../../../../store/src/types/api.types';
import { isAutoscalerEnabled } from '../../core/autoscaler-helpers/autoscaler-available';
import { AutoscalerConstants } from '../../core/autoscaler-helpers/autoscaler-util';
import {
  AutoscalerPaginationParams,
  DetachAppAutoscalerPolicyAction,
  GetAppAutoscalerAppMetricAction,
  GetAppAutoscalerPolicyAction,
  GetAppAutoscalerScalingHistoryAction,
} from '../../store/app-autoscaler.actions';
import {
  AppAutoscalerMetricData,
  AppAutoscalerPolicyLocal,
  AppAutoscalerScalingHistory,
  AppScalingTrigger,
  AppAutoscaleMetricChart,
} from '../../store/app-autoscaler.types';
import { appAutoscalerAppMetricEntityType, autoscalerEntityFactory } from '../../store/autoscaler-entity-factory';

@StratosTab({
  type: StratosTabType.Application,
  label: 'Autoscale',
  link: 'autoscale',
  icon: 'meter',
  iconFont: 'stratos-icons',
  hidden: (store: Store<AppState>, esf: EntityServiceFactory, activatedRoute: ActivatedRoute) => {
    const endpointGuid = getGuids('cf')(activatedRoute) || window.location.pathname.split('/')[2];
    return isAutoscalerEnabled(endpointGuid, esf).pipe(map(enabled => !enabled));
  }
})
@Component({
  selector: 'app-autoscaler-tab-extension',
  templateUrl: './autoscaler-tab-extension.component.html',
  styleUrls: ['./autoscaler-tab-extension.component.scss'],
  providers: [
    ApplicationMonitorService
  ]
})
export class AutoscalerTabExtensionComponent implements OnInit, OnDestroy {

  scalingRuleColumns: string[] = ['metric', 'condition', 'action'];
  specificDateColumns: string[] = ['from', 'to', 'init', 'min', 'max'];
  recurringScheduleColumns: string[] = ['effect', 'repeat', 'from', 'to', 'init', 'min', 'max'];
  scalingHistoryColumns: string[] = ['event', 'trigger', 'date', 'error'];
  metricTypes: string[] = AutoscalerConstants.MetricTypes;

  appAutoscalerPolicyService: EntityService<APIResource<AppAutoscalerPolicyLocal>>;
  public appAutoscalerScalingHistoryService: EntityService<APIResource<AppAutoscalerScalingHistory>>;
  appAutoscalerPolicy$: Observable<AppAutoscalerPolicyLocal>;
  appAutoscalerPolicySafe$: Observable<AppAutoscalerPolicyLocal>;
  appAutoscalerScalingHistory$: Observable<AppAutoscalerScalingHistory>;
  appAutoscalerAppMetricNames$: Observable<AppAutoscaleMetricChart[]>;

  public showNoPolicyMessage$: Observable<boolean>;
  public showAutoscalerHistory$: Observable<boolean>;

  public noPolicyMessageFirstLine = 'This application has no Autoscaler Policy';
  public noPolicyMessageSecondLine = {
    text: 'To create a policy click the + icon above'
  };

  private appAutoscalerPolicyErrorSub: Subscription;
  private appAutoscalerScalingHistoryErrorSub: Subscription;
  private appAutoscalerPolicySnackBarRef: MatSnackBarRef<SimpleSnackBar>;
  private appAutoscalerScalingHistorySnackBarRef: MatSnackBarRef<SimpleSnackBar>;
  private scalingHistoryAction: GetAppAutoscalerScalingHistoryAction;

  appAutoscalerAppMetrics = {};

  paramsMetrics: AutoscalerPaginationParams = {
    'start-time': ((new Date()).getTime() - 60000).toString() + '000000',
    'end-time': (new Date()).getTime().toString() + '000000',
    page: '1',
    'results-per-page': '1',
    'order-direction': 'desc'
  };
  paramsHistory: AutoscalerPaginationParams = {
    'start-time': '0',
    'end-time': (new Date()).getTime().toString() + '000000',
    page: '1',
    'results-per-page': '5',
    'order-direction': 'desc'
  };

  ngOnDestroy(): void {
    if (this.appAutoscalerPolicySnackBarRef) {
      this.appAutoscalerPolicySnackBarRef.dismiss();
    }
    if (this.appAutoscalerScalingHistorySnackBarRef) {
      this.appAutoscalerScalingHistorySnackBarRef.dismiss();
    }
    safeUnsubscribe(this.appAutoscalerPolicyErrorSub, this.appAutoscalerScalingHistoryErrorSub);
  }

  constructor(
    private store: Store<AppState>,
    private applicationService: ApplicationService,
    private entityServiceFactory: EntityServiceFactory,
    private paginationMonitorFactory: PaginationMonitorFactory,
    private appAutoscalerPolicySnackBar: MatSnackBar,
    private appAutoscalerScalingHistorySnackBar: MatSnackBar,
    private confirmDialog: ConfirmationDialogService,
  ) { }

  ngOnInit() {
    this.appAutoscalerPolicyService = this.entityServiceFactory.create(
      this.applicationService.appGuid,
      new GetAppAutoscalerPolicyAction(this.applicationService.appGuid, this.applicationService.cfGuid)
    );
    this.appAutoscalerPolicy$ = this.appAutoscalerPolicyService.entityObs$.pipe(
      filter(({ entityRequestInfo }) => entityRequestInfo && !entityRequestInfo.fetching),
      map(({ entity, }) => entity ? entity.entity : null),
      publishReplay(1),
      refCount()
    );
    this.appAutoscalerPolicySafe$ = this.appAutoscalerPolicyService.waitForEntity$.pipe(
      map(({ entity }) => entity && entity.entity),
      publishReplay(1),
      refCount()
    );

    this.loadLatestMetricsUponPolicy();

    this.appAutoscalerAppMetricNames$ = this.appAutoscalerPolicySafe$.pipe(
      map(entity => Object.keys(entity.scaling_rules_map).map((name) => {
        const unit = entity.scaling_rules_map[name].upper[0] && entity.scaling_rules_map[name].upper[0].unit
          || entity.scaling_rules_map[name].lower[0] && entity.scaling_rules_map[name].lower[0].unit;
        return {
          name,
          unit,
        };
      })),
    );

    this.scalingHistoryAction = new GetAppAutoscalerScalingHistoryAction(
      createEntityRelationPaginationKey(applicationEntityType, this.applicationService.appGuid, 'latest'),
      this.applicationService.appGuid,
      this.applicationService.cfGuid,
      true,
      this.paramsHistory
    );
    this.appAutoscalerScalingHistoryService = this.entityServiceFactory.create(
      this.applicationService.appGuid,
      this.scalingHistoryAction
    );
    this.appAutoscalerScalingHistory$ = this.appAutoscalerScalingHistoryService.entityObs$.pipe(
      map(({ entity }) => entity && entity.entity),
      publishReplay(1),
      refCount()
    );
    this.initErrorSub();

    this.showAutoscalerHistory$ = combineLatest([
      this.appAutoscalerPolicy$,
      this.appAutoscalerScalingHistory$
    ]).pipe(
      map(([policy, history]) => !!policy || (!!history && history.total_results > 0)),
      publishReplay(1),
      refCount()
    );

    this.showNoPolicyMessage$ = combineLatest([
      this.appAutoscalerPolicy$,
      this.appAutoscalerScalingHistory$
    ]).pipe(
      map(([policy, history]) => !policy && (!history || history.total_results === 0)),
      publishReplay(1),
      refCount()
    );
  }

  getAppMetric(metricName: string, trigger: AppScalingTrigger, params: AutoscalerPaginationParams) {
    const action = new GetAppAutoscalerAppMetricAction(this.applicationService.appGuid,
      this.applicationService.cfGuid, metricName, true, trigger, params);
    this.store.dispatch(action);
    return getPaginationObservables<AppAutoscalerMetricData>({
      store: this.store,
      action,
      paginationMonitor: this.paginationMonitorFactory.create(
        action.paginationKey,
        autoscalerEntityFactory(appAutoscalerAppMetricEntityType)
      )
    }, false).entities$;
  }

  loadLatestMetricsUponPolicy() {
    this.appAutoscalerPolicySafe$.pipe(
      first(),
    ).subscribe(appAutoscalerPolicy => {
      this.paramsMetrics['start-time'] = ((new Date()).getTime() - 60000).toString() + '000000';
      this.paramsMetrics['end-time'] = (new Date()).getTime().toString() + '000000';
      if (appAutoscalerPolicy.scaling_rules_map) {
        this.appAutoscalerAppMetrics = Object.keys(appAutoscalerPolicy.scaling_rules_map).reduce((metricMap, metricName) => {
          metricMap[metricName] = this.getAppMetric(metricName, appAutoscalerPolicy.scaling_rules_map[metricName], this.paramsMetrics);
          return metricMap;
        }, {});
      }
    });
  }

  initErrorSub() {
    if (this.appAutoscalerPolicyErrorSub) {
      this.appAutoscalerScalingHistoryErrorSub.unsubscribe();
    }

    this.appAutoscalerPolicyErrorSub = this.appAutoscalerPolicyService.entityMonitor.entityRequest$.pipe(
      filter(response => !!response.error && (!response.response || !response.response.noPolicy)),
      map(response => response.message),
      distinctUntilChanged(),
    ).subscribe(errorMessage => {
      if (this.appAutoscalerPolicySnackBarRef) {
        this.appAutoscalerPolicySnackBarRef.dismiss();
      }
      this.appAutoscalerPolicySnackBarRef = this.appAutoscalerPolicySnackBar.open(errorMessage, 'Dismiss');
    });

    if (this.appAutoscalerScalingHistoryErrorSub) {
      this.appAutoscalerScalingHistoryErrorSub.unsubscribe();
    }
    this.appAutoscalerScalingHistoryErrorSub = this.appAutoscalerScalingHistoryService.entityMonitor.entityRequest$.pipe(
      filter(request => !!request.error),
      map(request => request.message),
      distinctUntilChanged(),
    ).subscribe(errorMessage => {
      if (this.appAutoscalerScalingHistorySnackBarRef) {
        this.appAutoscalerScalingHistorySnackBarRef.dismiss();
      }
      this.appAutoscalerScalingHistorySnackBarRef = this.appAutoscalerScalingHistorySnackBar.open(errorMessage, 'Dismiss');
    });
  }

  disableAutoscaler() {
    const confirmation = new ConfirmationDialogConfig(
      'Delete Policy',
      'Are you sure you want to delete the policy?',
      'Delete',
      true
    );
    this.confirmDialog.open(confirmation, () => {
      this.detachPolicy().pipe(
        first(),
      ).subscribe(actionState => {
        if (actionState.error) {
          this.appAutoscalerPolicySnackBarRef =
            this.appAutoscalerPolicySnackBar.open(`Failed to detach policy: ${actionState.message}`, 'Dismiss');
        }
      });
    });
  }

  detachPolicy(): Observable<ActionState> {
    const action = new DetachAppAutoscalerPolicyAction(this.applicationService.appGuid, this.applicationService.cfGuid);
    this.store.dispatch(action);
    const entityKey = entityCatalogue.getEntityKey(action);

    return this.store.select(selectDeletionInfo(entityKey, this.applicationService.appGuid)).pipe(
      pairwise(),
      filter(([oldV, newV]) => oldV.busy && !newV.busy),
      map(([, newV]) => newV)
    );
  }

  updatePolicyPage = (isCreate = false) => {
    const query = isCreate ? {
      create: isCreate
    } : {};
    this.store.dispatch(new RouterNav({
      path: [
        'autoscaler',
        this.applicationService.cfGuid,
        this.applicationService.appGuid,
        'edit-autoscaler-policy'
      ],
      query
    }));
  }

  metricChartPage() {
    this.store.dispatch(new RouterNav({
      path: [
        'autoscaler',
        this.applicationService.cfGuid,
        this.applicationService.appGuid,
        'app-autoscaler-metric-page'
      ]
    }));
  }

  scaleHistoryPage() {
    this.store.dispatch(new RouterNav({
      path: [
        'autoscaler',
        this.applicationService.cfGuid,
        this.applicationService.appGuid,
        'app-autoscaler-scale-history-page'
      ]
    }));
  }

  fetchScalingHistory() {
    this.paramsHistory['end-time'] = (new Date()).getTime().toString() + '000000';
    this.store.dispatch(this.scalingHistoryAction);
  }

  getMetricUnit(metricType: string, unit?: string) {
    return AutoscalerConstants.getMetricUnit(metricType, unit);
  }

  manageCredentialPage = () => {
    this.store.dispatch(new RouterNav({
      path: [
        'autoscaler',
        this.applicationService.cfGuid,
        this.applicationService.appGuid,
        'edit-autoscaler-credential'
      ]
    }));
  }

}
