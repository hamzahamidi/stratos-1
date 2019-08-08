import { StratosOrchestratedActionBuilders } from '../../../core/src/core/entity-catalogue/action-orchestrator/action-orchestrator';
import {
  EnvVarStratosProject,
} from '../../../core/src/features/applications/application/application-tabs-base/tabs/build-tab/application-env-vars.service';
import { GitSCM } from '../../../core/src/shared/data-services/scm/scm';
import { FetchBranchesForProject, FetchCommit, FetchCommits } from '../actions/deploy-applications.actions';
import { FetchGitHubRepoInfo } from '../actions/github.actions';

export const gitRepoActionBuilders = {
  getRepoInfo: (
    projectEnvVars: EnvVarStratosProject
  ) => new FetchGitHubRepoInfo(projectEnvVars)
} as StratosOrchestratedActionBuilders;

interface GitMeta {
  projectName: string;
  scm: GitSCM;
}

export interface GitCommitActionBuilders extends StratosOrchestratedActionBuilders {
  get: (commitSha: string, endpointGuid: string, projectMeta: GitMeta) => FetchCommit;
  getMultiple: (commitSha: string, endpointGuid: string, projectMeta: GitMeta) => FetchCommits;
}

export const gitCommitActionBuilders: GitCommitActionBuilders = {
  get: (
    commitSha: string,
    endpointGuid: string,
    commitMeta: GitMeta
  ) => new FetchCommit(commitMeta.scm, commitSha, commitMeta.projectName),
  getMultiple: (
    commitSha: string,
    endpointGuid: string,
    commitMeta: GitMeta
  ) => new FetchCommits(commitMeta.scm, commitSha, commitMeta.projectName)
};

export interface GitBranchActionBuilders extends StratosOrchestratedActionBuilders {
  get: (projectName: string, endpointGuid: string, meta: GitMeta) => FetchBranchesForProject;
}

export const gitBranchActionBuilders: GitBranchActionBuilders = {
  get: (
    guid: string,
    endpointGuid: string,
    meta: GitMeta
  ) => new FetchBranchesForProject(meta.scm, meta.projectName)
};
