
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { GitBranch, GitCommit, GitPullRequest, Github } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { InfoIcon } from 'lucide-react';

const GitDocumentation = () => {
  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <GitBranch className="h-5 w-5" />
          Git Repository Management Documentation
        </CardTitle>
        <CardDescription>
          Learn how to use the Git repository management features in this application
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible className="w-full">
          <AccordionItem value="getting-started">
            <AccordionTrigger>Getting Started</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <p>
                  The Git repository management system allows you to clone, pull, and push changes to Git repositories,
                  including GitHub repositories. You can manage multiple repositories, switch between branches,
                  and view commit history.
                </p>
                <h3 className="text-lg font-medium">Adding a Repository</h3>
                <p>
                  To add a repository, click the "Add Repository" button in the top-right corner of the Git
                  Repositories card. Enter the repository URL, branch name (defaults to "main"), and optionally
                  a GitHub access token for private repositories.
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="basic-operations">
            <AccordionTrigger>Basic Repository Operations</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Pulling Changes</h3>
                <p>
                  To pull the latest changes from the remote repository, click the "Pull" button next to the
                  repository you want to update. This will fetch and merge the latest changes.
                </p>
                
                <h3 className="text-lg font-medium">Pushing Changes</h3>
                <p>
                  To push your local changes to the remote repository, click the "Push" button next to the
                  repository. Enter a commit message describing your changes, then click "Push Changes"
                  to send them to the remote repository.
                </p>
                
                <h3 className="text-lg font-medium">Repository Status</h3>
                <p>
                  Each repository displays its current status:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Synced</strong>: Your local repository is up-to-date with the remote.</li>
                  <li><strong>Modified</strong>: You have local changes that haven't been pushed.</li>
                  <li><strong>Conflict</strong>: There are merge conflicts that need to be resolved.</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="advanced-features">
            <AccordionTrigger>Advanced Git Features</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Branch Management</h3>
                <p>
                  When you select a repository, you can manage its branches:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Create Branch</strong>: Create a new branch from your current HEAD.</li>
                  <li><strong>Switch Branch</strong>: Switch to a different branch.</li>
                  <li><strong>Merge Branch</strong>: Merge changes from another branch into your current branch.</li>
                </ul>
                
                <h3 className="text-lg font-medium">Stash Management</h3>
                <p>
                  Stashes allow you to temporarily store changes without committing them:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Create Stash</strong>: Save your current changes to a stash.</li>
                  <li><strong>Apply Stash</strong>: Apply a stash to your working directory.</li>
                  <li><strong>Drop Stash</strong>: Remove a stash from your stash list.</li>
                </ul>
                
                <h3 className="text-lg font-medium">Tag Management</h3>
                <p>
                  Tags let you mark specific points in Git history:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Create Tag</strong>: Create a new tag at a specific commit.</li>
                  <li><strong>Delete Tag</strong>: Remove an existing tag.</li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="github-integration">
            <AccordionTrigger>GitHub Integration</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <p>
                  This application has special integration with GitHub repositories:
                </p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Authentication</strong>: You can provide a GitHub access token for private repositories.</li>
                  <li><strong>Visual Indicators</strong>: GitHub repositories are marked with the GitHub icon.</li>
                </ul>
                
                <Alert>
                  <InfoIcon className="h-4 w-4" />
                  <AlertTitle>GitHub Access Tokens</AlertTitle>
                  <AlertDescription>
                    To use private GitHub repositories, you'll need to create a personal access token
                    with the appropriate repository permissions. You can create one in your GitHub account settings.
                  </AlertDescription>
                </Alert>
              </div>
            </AccordionContent>
          </AccordionItem>
          
          <AccordionItem value="troubleshooting">
            <AccordionTrigger>Troubleshooting</AccordionTrigger>
            <AccordionContent>
              <div className="space-y-4">
                <h3 className="text-lg font-medium">Common Issues</h3>
                <ul className="list-disc pl-6 space-y-2">
                  <li>
                    <strong>Authentication Failures</strong>: If you're having trouble with a private repository,
                    make sure your access token has the correct permissions.
                  </li>
                  <li>
                    <strong>Push Rejected</strong>: This typically happens when the remote has changes that
                    you don't have locally. Try pulling first, then push again.
                  </li>
                  <li>
                    <strong>Merge Conflicts</strong>: When Git can't automatically merge changes, you'll need to
                    resolve conflicts manually before continuing.
                  </li>
                </ul>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default GitDocumentation;
