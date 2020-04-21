import * as core from '@actions/core';
import * as github from '@actions/github';

interface Options {
  issuePrefix: string;
  issueBaseUrl: string;
}

const prBodyIssuesReplaceRegex = new RegExp(
  '[//]:s?#s?(autolink_jira_issues_start)[sS]+[//]:s?#s?(autolink_jira_issues_end)',
  'gm',
);

const extractIssuesKeysFromBranch = (prBranchName: string, options: Options) => {
  const [_prefix, _description, ...jiraIssues] = prBranchName.split('/');
  return jiraIssues.filter((issue) => issue.startsWith(options.issuePrefix));
};

const createIssueLink = (issueKey: string, issueBaseUrl: string) => {
  return `${issueBaseUrl}/${issueKey}`;
};

function autolinkIssues(prBranchName: string, prBody: string | undefined, options: Options) {
  if (!prBody) return;

  const issuesKeys = extractIssuesKeysFromBranch(prBranchName, options);
  const issuesLinks = issuesKeys.map((issueKey) => createIssueLink(issueKey, options.issueBaseUrl));
  const issuesLinksFormatted = issuesLinks.join('\n');

  return prBody.replace(prBodyIssuesReplaceRegex, issuesLinksFormatted);
}

async function run() {
  try {
    if (!github.context.payload.pull_request) {
      throw {
        message: 'This action can only be executed from PR or Issue',
      };
    }

    const githubApiToken: string = core.getInput('github-token');
    const issueBaseUrl = core.getInput('issue-base-url', { required: true });
    const issuePrefix = core.getInput('issue-prefix', { required: true });
    const pullRquestBranchName = github.context.payload.pull_request.head.ref;
    const pullRequestBody = github.context.payload.pull_request?.body;

    console.log(pullRequestBody);
    const newBody = autolinkIssues(pullRquestBranchName, pullRequestBody, { issuePrefix, issueBaseUrl });
    console.log(newBody);

    const updateRequest = {
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: github.context.payload.pull_request.number,
      body: newBody,
    };

    const client = new github.GitHub(githubApiToken);
    // @ts-ignore
    const response = await client.pulls.update(updateRequest);

    if (response.status !== 200) {
      core.error('Updating pull request has failed');
    }

    const time = new Date().toTimeString();
    core.setOutput('time', time);
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
