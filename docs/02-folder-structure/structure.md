---
name: folder-structure
description: Complete directory organization and purpose of all folders in the project
area: 02
maintained_by: structure-analyst
created: 2026-03-30
updated: 2026-03-30
---

# Folder Structure

## Project Overview

This document describes the complete directory organization of the DR AI Workforce project. The project is a React-based application built with Vite, TypeScript, Supabase (PostgreSQL + Auth + Edge Functions), and OpenAI for AI-powered document generation and RAG-based search.

## Project Tree

```
workforce/
|
|- .dr_ai/                      # DR_AI framework internal state
|- .github/workflows/            # GitHub Actions CI/CD pipelines
|- .omc/                        # Claude Code HUD state
|- aws/terraform/               # AWS infrastructure as code
|- docs/                        # Project documentation (architecture, features, APIs)
|- public/                      # Static assets (favicon, data)
|- src/                         # Frontend source code
|   |- components/              # React components
|   |- contexts/                # React Context providers
|   |- hooks/                   # Custom React hooks (TanStack Query wrappers)
|   |- lib/                     # Business logic, services, utilities
|   |- locales/                 # i18n translation modules (pt-br, en-us)
|   |- pages/                   # Route-level page components
|   |- types/                   # TypeScript type definitions
|   |- App.tsx                  # Root React component
|   |- App.css                  # Global styles
|   |- config/                  # Runtime configuration
|   |- prompts/                 # Handlebars document templates
|   |- tests/                   # Integration and E2E tests
|   |- main.tsx                 # Application entry point
|   |- index.css                # Tailwind base styles
|   |- routes.tsx               # React Router route definitions
|   |- supabaseClient.ts        # Supabase client initialization
|   `- vite-env.d.ts            # Vite environment type declarations
|
|- supabase/                    # Supabase backend configuration
|   `- functions/               # Deno-based Edge Functions
|       |- _shared/             # Shared utilities (reused across all Edge Functions)
|       |- accessibility-test/  # Google PageSpeed API integration
|       |- add-meet-recorder/   # Adds a bot to MS Teams meetings
|       |- admin-create-user/   # Admin user provisioning
|       |- admin-soft-delete-user/  # Soft-delete user accounts
|       |- analyze-sprint/      # Sprint health analysis
|       |- analyze-transcript/  # Meeting transcript AI analysis
|       |- api-backlog-items/   # REST API for backlog CRUD operations
|       |- api-docs/            # API documentation endpoint
|       |- api-rag-search/     # RAG-powered search endpoint
|       |- api-sprint-details/  # Sprint detail retrieval
|       |- api-sprints-list/   # Sprint listing endpoint
|       |- api-task-assign/    # Task assignment endpoint
|       |- api-task-details/    # Task detail retrieval
|       |- api-task-status/    # Task status update endpoint
|       |- api-tasks-list/      # Task listing endpoint
|       |- api-team-members-list/  # Team member listing endpoint
|       |- create-meeting-notes/   # AI-generated meeting notes
|       |- create-prd/          # AI-generated Product Requirements Document
|       |- create-technical-specs/ # AI-generated technical specifications
|       |- create-test-cases/   # AI-generated test cases
|       |- create-unit-tests/   # AI-generated unit tests
|       |- create-user-story/  # AI-generated user stories
|       |- extract-pdf/         # PDF content extraction
|       |- generate-presigned-download-url/  # Secure file download URLs
|       |- microsoft-calendar-integration/   # MS Calendar sync
|       |- process-transcript/  # Meeting transcript processing
|       |- recall-bot-create/   # MS Teams bot creation
|       |- recall-bot-list/     # List recall bots
|       |- recall-transcript/   # Recall.ai transcript retrieval
|       |- recall-webhook/     # Recall.ai webhook handler
|       |- search/              # RAG search endpoint
|       |- search-engine/       # Search engine logic
|       |- sync-github-pr/      # GitHub Pull Request sync
|       `- sync-jira/           # JIRA issue sync
|
|- .env                         # Development environment variables
|- .env.production.template     # Production env template
|- .env.sample                  # Sample environment variables
|- .env.staging.template        # Staging env template
|- CLAUDE.md                    # Claude Code project instructions
|- GEMINI.md                    # Gemini CLI instructions
|- README.md                    # Project README
|- components.json              # Shadcn/ui component registry
|- deploy.sh                    # Deployment script
|- deno.lock                    # Deno dependency lock file
|- eslint.config.js             # ESLint flat-config configuration
|- index.html                   # HTML entry point
|- package.json                 # NPM dependencies and scripts
|- postcss.config.js            # PostCSS configuration for Tailwind
|- tailwind.config.ts           # Tailwind CSS theme configuration
|- tsconfig.app.json            # TypeScript compiler options for app
|- tsconfig.json                # Root TypeScript configuration
|- tsconfig.node.json           # TypeScript for Node.js tools
|- vitest.config.ts             # Vitest unit test configuration
`- vite.config.ts               # Vite bundler configuration
```

---

## src/components/

**Path:** `src/components/`

**Purpose:** All React UI components. Organized by feature domain to group related functionality.

### src/components/ai-agents/

**Path:** `src/components/ai-agents/`

**Purpose:** AI agent configuration and management UI. Handles the creation, editing, and audit of configurable AI agents with autonomy settings, coding behavior, communication rules, and integration preferences.

**Key files:**
- `AgentAuditLog.tsx` -- Change history for agent configurations
- `AgentCard.tsx` -- Card display for a single agent
- `AgentConfigHeader.tsx` -- Header with agent name and status
- `AgentConfigTabs.tsx` -- Tab navigation for config categories
- `AgentExportImportDialog.tsx` -- Import/export functionality
- `AgentTemplateDialog.tsx` -- Template selection and creation
- `fields/` -- Form field components for each setting type (BooleanField, EnumField, JsonField, NumberField, StringField, OverrideIndicator, SettingField, SettingSection, SettingsGrid)
- `tabs/` -- Configuration tab panels (AutonomyConfigTab, CodingConfigTab, CommunicationConfigTab, DocumentationConfigTab, GitConfigTab, IntegrationConfigTab, LearningConfigTab, PerformanceConfigTab, SchedulingConfigTab, SecurityConfigTab)

### src/components/auth/

**Path:** `src/components/auth/`

**Purpose:** Authentication-related UI components for login, signup, password management, and logout flows.

**Key files:**
- `AuthLayout.tsx` -- Layout wrapper for auth pages
- `ForgotPasswordForm.tsx` -- Password reset request form
- `LoginForm.tsx` -- Email/password login form
- `LogoutButton.tsx` -- User logout trigger
- `PasswordInput.tsx` -- Password input with visibility toggle
- `ResetPasswordForm.tsx` -- New password entry after reset
- `SignupForm.tsx` -- New user registration form

### src/components/backlog-creation/

**Path:** `src/components/backlog-creation/`

**Purpose:** Multi-step wizard for AI-powered backlog generation from meeting transcripts. Orchestrates the flow from source selection through generation to review and confirmation.

**Key files:**
- `BacklogGenerationProgress.tsx` -- Progress indicator for wizard steps
- `BacklogGenerationWizard.tsx` -- Step wizard container with navigation
- `steps/BacklogConfirmationStep.tsx` -- Final review before saving
- `steps/BacklogGenerationStep.tsx` -- AI generation execution step
- `steps/BacklogReviewStep.tsx` -- Review generated backlog items
- `steps/MeetingSourceStep.tsx` -- Select meeting transcript source

### src/components/backlog/

**Path:** `src/components/backlog/`

**Purpose:** Backlog management UI including board view, list view, CSV import, and statistics dashboards.

**Key files:**
- `BacklogBoard.tsx` -- Kanban-style board with drag-drop columns
- `BacklogBoardView.tsx` -- Board view container with filters
- `BacklogCSVInputMethod.tsx` -- CSV file upload for bulk import
- `BacklogColumn.tsx` -- Single column in the board view
- `BacklogConvertDialog.tsx` -- Convert backlog items to features/tasks
- `BacklogFilters.tsx` -- Filter controls (priority, status, area)
- `BacklogImportDialog.tsx` -- Import dialog with multiple methods
- `BacklogItem.tsx` -- Individual backlog item card
- `BacklogItemCreator.tsx` -- Inline creation form for new items
- `BacklogItemForm.tsx` -- Full form for editing backlog items
- `BacklogItemPreviewList.tsx` -- Preview list for generated items
- `BacklogStatistics.tsx` -- Dashboard statistics container
- `BacklogTable.tsx` -- Tabular view alternative to board
- `BacklogTextInputMethod.tsx` -- Plain-text bulk input
- `BacklogToolbar.tsx` -- Toolbar with actions and view toggles
- `statistics/` -- Statistic cards (AgeDistributionCard, BusinessValueMatrix, FeaturePipelineCard, HealthScoreCard)
- `backlog-styles.css` -- Component-specific CSS
- `STYLING_GUIDE.md` -- Backlog styling conventions

### src/components/bugs/

**Path:** `src/components/bugs/`

**Purpose:** Bug reporting and tracking UI including creation forms, list views, and severity/status badges.

**Key files:**
- `BugAnalysisDialog.tsx` -- AI-powered bug analysis dialog
- `BugCard.tsx` -- Card display for a single bug
- `BugCreateSheet.tsx` -- Slide-out sheet for new bug creation
- `BugFilters.tsx` -- Filter controls for bug list
- `BugForm.tsx` -- Complete bug creation/edit form
- `BugList.tsx` -- Paginated list of bugs
- `BugPriorityBadge.tsx` -- Badge showing priority level
- `BugSeverityBadge.tsx` -- Badge showing severity level
- `BugStatusBadge.tsx` -- Badge showing current status
- `index.ts` -- Barrel export file

### src/components/calendar-events/

**Path:** `src/components/calendar-events/`

**Purpose:** Calendar event display components, including hero sections and attendee cards for meeting details.

**Key files:**
- `AttendeeCard.tsx` -- Attendee avatar and details card
- `CalendarEventHeroSection.tsx` -- Hero banner for event detail page
- `CopyToMeetingDialog.tsx` -- Copy event details to meeting record

### src/components/calendar-integration/

**Path:** `src/components/calendar-integration/`

**Purpose:** Microsoft Calendar integration components for connecting accounts, managing permissions, and listing upcoming recorded meetings.

**Key files:**
- `CalendarConnectionStatus.tsx` -- Shows OAuth connection status
- `CalendarIntegrationCard.tsx` -- Card for calendar account
- `CalendarSelectionList.tsx` -- List of calendars to sync
- `ConnectMicrosoftButton.tsx` -- OAuth initiation button
- `UpcomingRecordedMeetings.tsx` -- List of meetings with recordings
- `index.ts` -- Barrel export file

### src/components/chat/

**Path:** `src/components/chat/`

**Purpose:** RAG-powered chat interface components for querying project knowledge.

**Key files:**
- `ChatContainer.tsx` -- Main chat interface wrapper
- `FloatingChatButton.tsx` -- Floating action button to open chat
- `MessageBubble.tsx` -- Individual chat message bubble
- `MessageInput.tsx` -- Text input with send functionality
- `MessageList.tsx` -- Scrollable message history
- `SourcesPanel.tsx` -- Citation sources panel showing retrieved context
- `index.ts` -- Barrel export file
- `standalone/` -- Standalone chat page (StandaloneChat, constants, types)

### src/components/common/

**Path:** `src/components/common/`

**Purpose:** Reusable UI components shared across multiple feature areas, including project selection and tag inputs.

**Key files:**
- `ProjectSelector.tsx` -- Project dropdown selector
- `TagInput.tsx` -- Multi-value tag input component

### src/components/dashboard/

**Path:** `src/components/dashboard/`

**Purpose:** Dashboard and statistics components for displaying project metrics, team performance, and governance indicators.

**Key files:**
- `DashboardStats.tsx` -- Key metric cards
- `GovernanceMetrics.tsx` -- Governance area metrics
- `PlanningMetrics.tsx` -- Planning area metrics
- `QualityMetrics.tsx` -- Quality/testing area metrics
- `TeamPerformanceChart.tsx` -- Team performance visualization

### src/components/development/

**Path:** `src/components/development/`

**Purpose:** Development area components including style guide management, code review metrics, pull request dashboards, and AI agent configuration.

**Key files:**
- `AIAgentCreationDialog.tsx` -- Dialog for creating new AI agents
- `AIAgentSettings.tsx` -- Settings panel for agent configuration
- `AnalysisReportDetail.tsx` -- Detailed view of analysis report
- `AnalysisReportList.tsx` -- List of analysis reports
- `CodeReviewMetrics.tsx` -- Code review statistics
- `DevPerformanceDashboard.tsx` -- Developer performance metrics
- `PRMetricsDashboard.tsx` -- Pull request statistics
- `PullRequestList.tsx` -- List of GitHub PRs
- `RefactorInsights.tsx` -- Code refactoring suggestions
- `StyleGuideChatSettings.tsx` -- Chat settings for style guide
- `StyleGuideList.tsx` -- List of available style guides
- `StyleGuideViewer.tsx` -- Style guide content viewer with Monaco editor

### src/components/features/

**Path:** `src/components/features/`

**Purpose:** Feature management UI for the Planning area. Features are high-level product requirements that can be broken down into tasks.

**Key files:**
- `FeatureAttachments.tsx` -- File attachments for a feature
- `FeatureCard.tsx` -- Card display for a feature
- `FeatureCreateDialog.tsx` -- Dialog for creating new features
- `FeatureDetailSheet.tsx` -- Slide-out detail panel
- `FeatureFilters.tsx` -- Filter controls for feature list
- `FeatureForm.tsx` -- Feature creation/edit form
- `FeatureList.tsx` -- Paginated feature list
- `FeatureRelationshipGraph.tsx` -- Visual graph of feature dependencies
- `FeatureRelationships.tsx` -- Relationship management panel

### src/components/governance/

**Path:** `src/components/governance/`

**Purpose:** Governance area components including access control, allocation requests, JIRA integration configuration, platform settings, and RAG configuration.

**Key files:**
- `AccessControlForm.tsx` -- Access control rules editor
- `AllocationRequests.tsx` -- Team member allocation management
- `GovernanceAreaAccess.tsx` -- Area-level access management
- `GovernanceDocumentList.tsx` -- Governance document listing
- `GovernanceJiraConfigForm.tsx` -- JIRA integration configuration
- `GovernanceJiraList.tsx` -- List of JIRA integrations
- `MeetingRecordingConfig.tsx` -- MS Teams recording bot config
- `MeetingShare.tsx` -- Meeting sharing configuration
- `PlatformSettings.tsx` -- Platform-wide settings
- `RagConfig.tsx` -- RAG search configuration
- `UserCreationForm.tsx` -- Admin user creation form
- `UserManagement.tsx` -- User lifecycle management table

### src/components/knowledge-base/

**Path:** `src/components/knowledge-base/`

**Purpose:** Project knowledge base UI for managing structured knowledge entries organized by category and objectives.

**Key files:**
- `KnowledgeCategory.tsx` -- Category grouping for knowledge entries
- `KnowledgeEntryForm.tsx` -- Form for creating/editing entries
- `KnowledgeList.tsx` -- Paginated knowledge entry list

### src/components/layout/

**Path:** `src/components/layout/`

**Purpose:** Application shell components including sidebar navigation, header, and area-specific layouts.

**Key files:**
- `AreaNavLinks.tsx` -- Area-specific navigation links
- `Sidebar.tsx` -- Main application sidebar
- `SidebarHeader.tsx` -- Sidebar branding and project selector
- `SidebarNav.tsx` -- Navigation menu items
- `SidebarTeamSelector.tsx` -- Team selection in sidebar
- `TopBar.tsx` -- Top navigation bar

### src/components/meetings/

**Path:** `src/components/meetings/`

**Purpose:** Meeting management UI including creation forms, detail views, participant management, transcript display, and sharing.

**Key files:**
- `MeetingCard.tsx` -- Card display for a meeting
- `MeetingDetailSheet.tsx` -- Slide-out detail panel
- `MeetingForm.tsx` -- Meeting creation/edit form
- `MeetingFormBasicInfo.tsx` -- Basic information section of form
- `MeetingFormDateTime.tsx` -- Date and time section
- `MeetingFormParticipants.tsx` -- Participant selection
- `MeetingFormRecording.tsx` -- Recording settings section
- `MeetingFormReview.tsx` -- Review step before save
- `MeetingList.tsx` -- Paginated meeting list
- `MeetingParticipantForm.tsx` -- Add/edit participant
- `MeetingRecordingInfo.tsx` -- Recording status and controls
- `MeetingShareSettings.tsx` -- Sharing and visibility settings
- `MeetingTranscript.tsx` -- Transcript display component
- `MeetingViewPreferenceToggle.tsx` -- Toggle between list/detail view
- `PublicMeetingShare.tsx` -- Public share link management
- `PublicMeetingViewer.tsx` -- Public read-only meeting view

### src/components/planning/

**Path:** `src/components/planning/`

**Purpose:** Planning area components for AI-powered document generation including PRD, user stories, meeting notes, technical specs, and test cases.

**Key files:**
- `PlanningDocumentCreator.tsx` -- Main document generation orchestrator
- `PlanningDocumentForm.tsx` -- Form for document generation parameters

### src/components/projects/

**Path:** `src/components/projects/`

**Purpose:** Project management components including access control, collaboration management, repository management, and project creation wizard.

**Key files:**
- `AccessStatusBadge.tsx` -- Access level badge
- `BulkAccessDialog.tsx` -- Bulk access modification
- `BulkActionsBar.tsx` -- Bulk action toolbar
- `BulkDeleteDialog.tsx` -- Bulk delete confirmation
- `BulkOwnerAssignDialog.tsx` -- Bulk owner assignment
- `DocumentList.tsx` -- Project document listing
- `DocumentManager.tsx` -- Document upload and management
- `DocumentUpload.tsx` -- File upload component
- `GitRepositoryForm.tsx` -- Git repository connection form
- `GitRepositoryItem.tsx` -- Single repository item
- `GitRepositoryManager.tsx` -- Repository management panel
- `MemberListItem.tsx` -- Team member list item
- `ProjectAccessBadge.tsx` -- Project access level badge
- `ProjectAccessControl.tsx` -- Access control settings
- `ProjectAccessManager.tsx` -- Access management panel
- `ProjectActionsDropdown.tsx` -- Project action menu
- `ProjectActivityFeed.tsx` -- Recent activity feed
- `ProjectAvatar.tsx` -- Project avatar/initial display
- `ProjectBrandingFields.tsx` -- Branding metadata fields
- `ProjectCollaborators.tsx` -- Collaborator management
- `ProjectDeleteDialog.tsx` -- Delete confirmation dialog
- `ProjectDetailsCard.tsx` -- Project summary card
- `ProjectDetailsHeader.tsx` -- Project header section
- `ProjectFilters.tsx` -- Filter controls
- `ProjectFormDialog.tsx` -- Project creation/edit dialog
- `ProjectImportExportDialog.tsx` -- Data import/export
- `ProjectLeaderManager.tsx` -- Lead assignment
- `ProjectMemberManager.tsx` -- Member management
- `ProjectOverviewTab.tsx` -- Overview tab content
- `ProjectPermissionRules.tsx` -- Permission rules editor
- `ProjectPermissionsDialog.tsx` -- Permissions configuration
- `ProjectStatsCards.tsx` -- Statistics cards
- `ProjectTeamSelector.tsx` -- Team selection
- `ProjectVisibilitySettings.tsx` -- Visibility configuration
- `ProjectVisibilityToggle.tsx` -- Public/private toggle
- `TeamMemberManager.tsx` -- Team member management
- `wizard/` -- Multi-step project creation wizard (ProjectCreationWizard, WizardNavigation, WizardProgress, steps/BasicInfoStep including AIDescriptionChat, ChatInput, ChatMessage, DocumentSuggestions, FileUploadGuidance; steps/LinksStep, ReviewStep, TagsAndMetaStep, TeamStep)

### src/components/sprints/

**Path:** `src/components/sprints/`

**Purpose:** Sprint management components including creation forms, task assignment, and velocity tracking.

**Key files:**
- `SprintAnalytics.tsx` -- Sprint analytics dashboard
- `SprintCard.tsx` -- Card display for a sprint
- `SprintCreateDialog.tsx` -- Sprint creation dialog
- `SprintFilters.tsx` -- Sprint filter controls
- `SprintList.tsx` -- Paginated sprint list
- `SprintTaskBoard.tsx` -- Kanban board of sprint tasks
- `SprintVelocityChart.tsx` -- Velocity trend chart

### src/components/tasks/

**Path:** `src/components/tasks/`

**Purpose:** Task management components including CRUD operations, kanban board, sprint assignment, and AI suggestion integration.

**Key files:**
- `TaskAssigneeSelector.tsx` -- Assignee dropdown selector
- `TaskAttachmentList.tsx` -- Task file attachments
- `TaskBoard.tsx` -- Kanban board with status columns
- `TaskCard.tsx` -- Card display for a task
- `TaskColumn.tsx` -- Single status column
- `TaskCreateDialog.tsx` -- Task creation dialog
- `TaskDetailSheet.tsx` -- Slide-out task detail panel
- `TaskFilters.tsx` -- Filter controls for task list
- `TaskForm.tsx` -- Task creation/edit form
- `TaskFormBasicInfo.tsx` -- Basic info section
- `TaskFormDescription.tsx` -- Description with AI enhancement
- `TaskFormEstimates.tsx` -- Estimate fields (points, hours)
- `TaskFormMetadata.tsx` -- Metadata fields (labels, area)
- `TaskFormReview.tsx` -- Review step before save
- `TaskList.tsx` -- Paginated task list
- `TaskPriorityBadge.tsx` -- Priority indicator badge
- `TaskStatusBadge.tsx` -- Status indicator badge
- `TaskSprintSelector.tsx` -- Sprint assignment selector

### src/components/transcriptions/

**Path:** `src/components/transcriptions/`

**Purpose:** Meeting transcription UI components including document generation triggers and related document display.

**Key files:**
- `DocumentGenerator.tsx` -- Document generation from transcript
- `RelatedDocuments.tsx` -- Documents generated from this transcript
- `TranscriptEditor.tsx` -- Editable transcript view
- `TranscriptList.tsx` -- List of meeting transcripts

### src/components/ui/

**Path:** `src/components/ui/`

**Purpose:** Shadcn/ui base component library. All components are built on Radix UI primitives and styled with Tailwind CSS. This directory contains the foundational UI building blocks used throughout the application.

**Key files:**
- `alert-dialog.tsx` -- Alert dialog (Radix AlertDialog)
- `aspect-ratio.tsx` -- Aspect ratio container
- `avatar.tsx` -- Avatar with image/fallback (Radix Avatar)
- `badge.tsx` -- Status and label badges
- `button.tsx` -- Button with variants (Radix Slot)
- `calendar.tsx` -- Calendar date picker (react-day-picker)
- `card.tsx` -- Card container components
- `carousel.tsx` -- Image/content carousel (embla-carousel)
- `chart.tsx` -- Chart wrapper (recharts)
- `checkbox.tsx` -- Checkbox input (Radix Checkbox)
- `collapsible.tsx` -- Collapsible section (Radix Collapsible)
- `command.tsx` -- Command palette (cmdk)
- `context-menu.tsx` -- Right-click context menu (Radix ContextMenu)
- `dialog.tsx` -- Modal dialog (Radix Dialog)
- `dropdown-menu.tsx` -- Dropdown menu (Radix DropdownMenu)
- `form.tsx` -- React Hook Form + Zod integration
- `hover-card.tsx` -- Hover reveal card (Radix HoverCard)
- `input.tsx` -- Text input field
- `label.tsx` -- Form label (Radix Label)
- `menubar.tsx` -- Menu bar (Radix Menubar)
- `navigation-menu.tsx` -- Navigation menu (Radix NavigationMenu)
- `popover.tsx` -- Popover panel (Radix Popover)
- `progress.tsx` -- Progress bar (Radix Progress)
- `radio-group.tsx` -- Radio button group (Radix RadioGroup)
- `resizable.tsx` -- Resizable panel (react-resizable-panels)
- `scroll-area.tsx` -- Custom scrollbar (Radix ScrollArea)
- `select.tsx` -- Select dropdown (Radix Select)
- `separator.tsx` -- Horizontal/vertical divider (Radix Separator)
- `sheet.tsx` -- Slide-out panel (vaul)
- `skeleton.tsx` -- Loading placeholder
- `slider.tsx` -- Range slider (Radix Slider)
- `sonner.tsx` -- Toast notifications (sonner)
- `switch.tsx` -- Toggle switch (Radix Switch)
- `table.tsx` -- Table components (thead, tbody, tr, td, th)
- `tabs.tsx` -- Tab panels (Radix Tabs)
- `textarea.tsx` -- Multi-line text input
- `toast.tsx` -- Toast notification components
- `toggle.tsx` -- Toggle button (Radix Toggle)
- `toggle-group.tsx` -- Toggle button group (Radix ToggleGroup)
- `tooltip.tsx` -- Tooltip (Radix Tooltip)
- `use-toast.ts` -- Toast hook and utilities

### src/components/quality/

**Path:** `src/components/quality/`

**Purpose:** Quality and testing area components including accessibility testing, automated test generation, bug reports, and performance testing.

**Key files:**
- `AccessibilityReportViewer.tsx` -- Accessibility test results display
- `AccessibilityTestForm.tsx` -- URL input for accessibility test
- `AutomatedTestDashboard.tsx` -- Automated test overview
- `BugReportsDashboard.tsx` -- Bug statistics dashboard
- `PerformanceReportViewer.tsx` -- Performance test results
- `PerformanceTestForm.tsx` -- Performance test configuration
- `TestCaseDetail.tsx` -- Test case detail view
- `TestCaseForm.tsx` -- Test case creation/edit
- `TestCaseList.tsx` -- Test case listing
- `TestGeneratorForm.tsx` -- AI test generation form

---

## src/contexts/

**Path:** `src/contexts/`

**Purpose:** React Context providers for global application state that does not belong in TanStack Query (server state). Includes authentication, project selection, and team management.

**Key files:**
- `AuthContext.tsx` -- Supabase authentication state and methods (user session, sign in/out)
- `ProjectSelectionContext.tsx` -- Current selected project state and methods (selectedProject, selectProject)
- `TeamContext.tsx` -- Current team context for multi-team scenarios

---

## src/hooks/

**Path:** `src/hooks/`

**Purpose:** Custom React hooks, primarily thin wrappers around TanStack Query that encapsulate data fetching, mutations, and caching logic for each feature domain. Organized by feature.

**Key subdirectories and files:**

- `documents/` -- Document-related hooks (useDocumentActions, useDocumentFilters, useDocumentPagination, useDocumentSelection, useDocumentSort)
- `__tests__/` -- Unit tests for hooks

**Key hook files (top-level):**

| Category | Hook Files |
|----------|-----------|
| **AI Agents** | `useAIAgents.ts`, `useAgentConfig.ts`, `useAgentConfigAudit.ts`, `useAgentConfigTemplates.ts` |
| **Accessibility** | `useAccessibilityTest.ts` |
| **Admin** | `useAdminUserCreation.ts` |
| **Area Access** | `useAreaAccess.ts`, `useAreaDetection.ts` |
| **Backlog** | `useBacklog.ts`, `useBacklogDragDrop.ts`, `useBacklogGeneration.ts` |
| **Batch Operations** | `useBatchSprintCreation.ts`, `useBatchTaskOperations.ts`, `useBulkProjectActions.ts` |
| **Bugs** | `useBugById.ts`, `useBugCreate.ts`, `useBugStatistics.ts`, `useBugs.ts` |
| **Calendar** | `useCalendarConnection.ts`, `useCalendarEventDetail.ts`, `useCopyCalendarEventToMeeting.ts` |
| **Code Review** | `useCodeReviewMetrics.ts` |
| **Company Knowledge** | `useCompanyKnowledge.ts` |
| **Dashboard** | `useDashboardStats.ts` |
| **Description Generation** | `useDescriptionGeneration.ts`, `useEnhanceDescription.ts` |
| **Dev Performance** | `useDevPerformance.ts` |
| **Documents** | `useDocumentApproval.ts`, `useDocumentContent.ts`, `useDocumentTypes.ts`, `useDocumentUpdate.ts`, `useDocuments.ts`, `usePlanningDocuments.ts` |
| **Features** | `useFeatureAttachments.ts`, `useFeatureGeneration.ts`, `useFeatureRelationships.ts`, `useFeatures.ts` |
| **Generate Tasks** | `useGenerateTasks.ts` |
| **GitHub** | `useGitHubAccountMappings.ts`, `useGitHubPRMetrics.ts`, `useGitHubPRStats.ts`, `useGitHubPullRequestDetail.ts`, `useGitHubPullRequests.ts`, `useGitRepositories.ts` |
| **Governance** | `useGovernance.ts`, `useGovernanceDocuments.ts`, `useGovernanceIndexingStatus.ts`, `useGovernanceJiraConfig.ts` |
| **Indexing** | `useIgnoredRecords.ts`, `useIndexingStatus.ts` |
| **JIRA** | `useJiraConfig.ts`, `useJiraSync.ts` |
| **Load Test** | `useLoadTest.ts` |
| **Meetings** | `useMeetingAssets.ts`, `useMeetingDetails.ts`, `useMeetingMutations.ts`, `useMeetingRecordingSettings.ts`, `useMeetingShareToken.ts`, `useMeetingTranscripts.ts`, `useMeetingViewPreference.ts`, `useMeetingWithTranscript.ts`, `useMeetings.ts` |
| **Member Allocation** | `useMemberAllocation.ts`, `useMemberProjects.ts` |
| **Mentions** | `useMentionAutocomplete.ts` |
| **Notifications** | `useNotificationPreferences.ts` |
| **Performance** | `useErrorMonitor.ts`, `usePerformanceMonitor.ts`, `usePerformanceTest.ts` |
| **Platform** | `usePlatformSettings.ts` |
| **Presigned URLs** | `usePresignedDownload.ts`, `usePresignedUpload.ts` |
| **Profiles** | `useProfiles.ts` |
| **Projects** | `useProjectActivity.ts`, `useProjectCollaborators.ts`, `useProjectMembers.ts`, `useProjectPermissions.ts`, `useProjectSelection.ts`, `useProjectTeamMembers.ts`, `useProjectTeams.ts` |
| **Reports** | `useAnalysisReports.ts`, `useCentralizedDocumentTypes.ts` |
| **Share Tokens** | `useAllShareTokens.ts` |
| **Share Allocation** | `useAllocationRequests.ts` |
| **Style Guide Chat** | `useStyleGuideChatSettings.ts` |
| **UI Utilities** | `useDebounce.ts`, `useI18n.ts`, `useToast.ts` |

---

## src/lib/

**Path:** `src/lib/`

**Purpose:** Core business logic, service classes, utilities, AI integrations, and RAG implementation. This is the largest and most critical directory, containing all shared logic not specific to a single component.

### src/lib/openai*.ts

**Path:** `src/lib/openai*.ts`

**Purpose:** OpenAI API integration layer. Handles AI-powered document generation, conversation tracking, and AI-enhanced task description generation.

**Key files:**
- `openai.ts` -- Main OpenAI client with Responses API integration for document generation (legacy; deprecated for document generation in favor of Edge Functions; still used for task creation)
- `openai-secure.ts` -- Secure OpenAI client wrapper (server-side key management pattern)
- `openai.test.ts` -- Unit tests for OpenAI integration

### src/lib/services/

**Path:** `src/lib/services/`

**Purpose:** Service classes that encapsulate business logic and Supabase interactions for each feature domain. These services abstract database operations behind a clean API.

**Key files:**

| Service | Purpose |
|---------|---------|
| `admin-user-service.ts` | Admin user provisioning and management |
| `agent-config-service.ts` | AI agent configuration CRUD and versioning |
| `ai-document-generation.ts` | AI document generation orchestration |
| `analysis-reports-service.ts` | Code analysis report management |
| `backlog-conversion.ts` | Convert backlog items to features/tasks |
| `backlog-service.ts` | Backlog item CRUD operations |
| `bug-service.ts` | Bug report CRUD and statistics |
| `calendar-integration-service.ts` | Microsoft Calendar OAuth and sync |
| `code-review-metrics-service.ts` | Code review metric calculations |
| `comment-service.ts` | Task and document comments |
| `description-synthesizer.ts` | AI description enhancement |
| `dev-performance-service.ts` | Developer performance metrics |
| `document-generation-service.ts` | Frontend wrapper for Edge Function document generation |
| `enhanced-project-service.ts` | Extended project operations |
| `feature-attachment-service.ts` | Feature file attachments |
| `feature-service.ts` | Feature CRUD and relationships |
| `github-pr-metrics-service.ts` | GitHub PR metric calculations |
| `github-sync-service.ts` | GitHub PR synchronization |
| `governance-service.ts` | Governance area operations |
| `indexing-service.ts` | RAG indexing management |
| `jira-integration-service.ts` | JIRA synchronization and metrics |
| `meeting-recording-service.ts` | MS Teams recording bot management |
| `meeting-service.ts` | Meeting CRUD operations |
| `member-allocation-service.ts` | Team member allocation |
| `microsoft-auth-service.ts` | MS OAuth token management |
| `microsoft-calendar-service.ts` | MS Calendar API operations |
| `openai-cost-tracking-service.ts` | Token usage and cost tracking |
| `permission-service.ts` | Permission checking and enforcement |
| `platform-settings-service.ts` | Platform-wide configuration |
| `presigned-url-service.ts` | Secure upload/download URL generation |
| `project-import-export-service.ts` | Project data import/export |
| `project-service.ts` | Core project CRUD operations |
| `pull-request-service.ts` | GitHub PR management |
| `rag-search-service.ts` | RAG search operations |
| `recall-bot-service.ts` | Recall.ai bot management |
| `refactor-insight-service.ts` | Refactoring suggestion management |
| `repository-service.ts` | Git repository management |
| `search-engine-service.ts` | Search indexing and retrieval |
| `share-token-service.ts` | Share token generation and validation |
| `sprint-service.ts` | Sprint CRUD and analytics |
| `style-guide-service.ts` | Style guide management |
| `suggested-task-service.ts` | AI task suggestions |
| `task-service.ts` | Task CRUD operations |
| `team-member-service.ts` | Team member management |
| `team-service.ts` | Team CRUD operations |
| `token-usage-service.ts` | AI token usage tracking |
| `transcript-service.ts` | Meeting transcript management |
| `transcript-streaming-service.ts` | Streaming transcript processing |
| `user-access-service.ts` | User access level management |
| `user-profile-service.ts` | User profile CRUD |
| `__tests__/` | Unit tests for services |

### src/lib/utils/

**Path:** `src/lib/utils/`

**Purpose:** Pure utility functions for formatting, validation, date handling, and common operations.

**Key files:**
- `cn.ts` -- Class name merger (clsx + tailwind-merge)
- `date.ts` -- Date formatting and manipulation utilities
- `error.ts` -- Error handling utilities
- `format.ts` -- General formatting helpers (currency, number, text)
- `id.ts` -- ID generation utilities
- `priority.ts` -- Priority level helpers
- `status.ts` -- Status mapping utilities
- `text.ts` -- Text manipulation utilities
- `validation.ts` -- Zod schemas and validation helpers

### src/lib/rag/

**Path:** `src/lib/rag/`

**Purpose:** Retrieval-Augmented Generation (RAG) implementation for knowledge-based chat and search. Handles vector storage, embedding generation, search orchestration, and conversation context.

**Key files:**
- `chat-service.ts` -- RAG chat orchestration (builds context, calls OpenAI, streams response)
- `conversation-context.ts` -- Maintains conversation history for RAG sessions
- `embedding-generator.ts` -- OpenAI embedding generation for document chunking
- `index.ts` -- Barrel export
- `initial-indexer.ts` -- Initial project content indexing
- `prompt-builder.ts` -- Builds system and user prompts with retrieved context
- `prompts/context-formatters.ts` -- Formats retrieved documents for prompts
- `prompts/grounding-rules.ts` -- Grounding rules for AI responses
- `prompts/index.ts` -- Prompt barrel exports
- `prompts/query-analyzer.ts` -- Analyzes user queries for search strategy
- `prompts/reasoning-templates.ts` -- Chain-of-thought reasoning templates
- `prompts/system-prompts.ts` -- System prompt templates
- `prompts/types.ts` -- Prompt-related type definitions
- `prompts/user-facing-messages.ts` -- Localized user-facing messages
- `search-engine.ts` -- Semantic search implementation using cosine similarity
- `source-tracker.ts` -- Tracks which documents were used as context
- `streaming-client.ts` -- Streaming OpenAI response handler for RAG
- `sync-orchestrator.ts` -- Coordinates content changes with vector store updates
- `vector-storage.ts` -- Vector storage abstraction (SQLite via Turso/libSQL)

### src/lib/security/

**Path:** `src/lib/security/`

**Purpose:** Security utilities for input sanitization and cryptographic operations.

**Key files:**
- `crypto.ts` -- Encryption/decryption utilities
- `input-sanitizer.ts` -- User input sanitization
- `sanitization.ts` -- General sanitization helpers

### src/lib/jira/

**Path:** `src/lib/jira/`

**Purpose:** JIRA integration utilities including status mapping, error translation, and formatting.

**Key files:**
- `error-translator.ts` -- Translates JIRA API errors to user messages
- `formatters.ts` -- JIRA field formatters
- `status-mappings.ts` -- Maps JIRA statuses to internal statuses

### src/lib/mock-data/

**Path:** `src/lib/mock-data/`

**Purpose:** Mock data for development and testing scenarios.

**Key files:**
- `legacy-code/` -- Mock data for legacy code analysis features (code-health-data, compatibility-data, migration-tracker-data, refactoring-plans-data, tech-debt-data, index)

### src/lib/observability/

**Path:** `src/lib/observability/`

**Purpose:** Observability and monitoring utilities for error sanitization and logging.

**Key files:**
- `sanitize-error.ts` -- Strips sensitive information from error objects

### src/lib/constants/

**Path:** `src/lib/constants/`

**Purpose:** Application-wide constants and static configuration data.

**Key files:**
- `drag-drop.ts` -- Drag-and-drop configuration
- `meeting-template-variables.ts` -- Template variable definitions
- `meeting-type-templates.ts` -- Meeting type templates

### src/lib/navigation/

**Path:** `src/lib/navigation/`

**Purpose:** Navigation utilities including area-to-route mapping.

**Key files:**
- `areaMapping.ts` -- Maps navigation areas to routes and metadata

### src/lib/migrations/

**Path:** `src/lib/migrations/`

**Purpose:** Data migration scripts for schema and feature updates.

**Key files:**
- `prompt-to-document-migration.ts` -- Migrates prompt-based docs to document model

### Other lib files:

| File | Purpose |
|------|---------|
| `advanced-integration-patterns.ts` | Advanced AI integration patterns |
| `analytics-dashboard.ts` | Analytics dashboard utilities |
| `audit-trail.ts` | Audit logging utilities |
| `backward-compatibility.ts` | Legacy code compatibility helpers |
| `cache-config.ts` | Cache configuration |
| `chunk-error-handler.ts` | Chunk processing error handling |
| `conversation-context-utils.ts` | Conversation context utilities |
| `conversation-tracking.ts` | AI conversation tracking |
| `conversation-tracking-integration.ts` | Conversation tracking integration |
| `cost-management.ts` | AI cost management utilities |
| `cost-monitoring-dashboard.ts` | Cost monitoring display utilities |
| `document-model-selector.ts` | Document model selection logic |
| `document-pipeline.ts` | Document processing pipeline |
| `enhanced-project-context.ts` | Enhanced project context utilities |
| `errors/voice-recording-errors.ts` | Voice recording error definitions |
| `feature-toggles.ts` | Feature flag management |
| `instruction-loader.ts` | Loads instructions for AI agents |
| `intelligent-caching.ts` | Intelligent caching strategy |
| `knowledge-context.ts` | Knowledge base context utilities |
| `lazy-with-retry.ts` | Lazy loading with retry logic |
| `legacy-code-utils.ts` | Legacy code analysis utilities |
| `logger.ts` | Application logging |
| `meeting-project-service.ts` | Meeting-project relationship service |
| `migration-utilities.ts` | General migration helpers |
| `optimized-sequential-generator.ts` | Optimized sequential document generation |
| `pattern-quality-assessment.ts` | Code pattern quality scoring |
| `performance-comparison.ts` | Performance comparison utilities |
| `performance-monitoring.ts` | Performance monitoring utilities |
| `predictive-quality-analysis.ts` | Predictive quality analysis |
| `projects-import-export.ts` | Project import/export |
| `projects.ts` | Project utilities |
| `prompt-loader.ts` | Loads AI prompts from files |
| `prompt-storage.ts` | Prompt storage utilities |
| `prompt-templates.ts` | Prompt template definitions |
| `prompts.ts` | Prompt definitions |
| `quality-gates.ts` | Quality gate definitions |
| `quality-metrics-calculator.ts` | Quality metric calculations |
| `quality-validation.ts` | Quality validation logic |
| `sequential-caching-system.ts` | Sequential caching implementation |
| `sequential-cost-optimizer.ts` | Cost optimization for sequential operations |
| `sequential-document-generator.ts` | Sequential document generation |
| `sequential-error-recovery.ts` | Error recovery for sequential operations |
| `sequential-generation-refactored.ts` | Refactored sequential generation |

---

## src/pages/

**Path:** `src/pages/`

**Purpose:** Route-level page components. Each file typically corresponds to one URL route defined in `src/routes.tsx`. Pages compose smaller components to create full page layouts.

**Key pages:**

| Route Area | Page Files |
|------------|-----------|
| **Root** | `ChatPage.tsx`, `Code.tsx`, `Dashboard.tsx`, `DemosPage.tsx`, `DocumentsListingPage.tsx`, `ForgotPassword.tsx`, `KnowledgeFormPage.tsx`, `KnowledgeListPage.tsx`, `Login.tsx`, `ManageProjects.tsx`, `MeetingCreate.tsx`, `MeetingEdit.tsx`, `MeetingList.tsx`, `Metrics.tsx`, `MyDraftsPage.tsx`, `NotFound.tsx`, `PermissionsVisibilityPage.tsx`, `ProjectDetails.tsx`, `ProjectForm.tsx`, `ProjectSelector.tsx`, `QA.tsx`, `RepositoriesListingPage.tsx`, `ResetPassword.tsx`, `SprintList.tsx`, `StandaloneChatTestPage.tsx`, `SuggestedTasks.tsx`, `TaskDocumentViewerPage.tsx`, `Tasks.tsx`, `Teams.tsx`, `UploadMedia.tsx` |
| **Admin** | `admin/IndexingManagementPage.tsx` |
| **Areas (Landing)** | `areas/DevelopmentLanding.tsx`, `areas/GovernanceLanding.tsx`, `areas/LegacyCodeLanding.tsx`, `areas/PlanningLanding.tsx`, `areas/QualityLanding.tsx` |
| **Auth Callbacks** | `auth/CalendarOAuthCallback.tsx` |
| **Backlog** | `backlog/BacklogBoardPage.tsx`, `backlog/BacklogGenerationPage.tsx`, `backlog/BacklogHubPage.tsx`, `backlog/BacklogListPage.tsx`, `backlog/BacklogPrioritizationPage.tsx`, `backlog/BacklogStatisticsPage.tsx` |
| **Calendar Events** | `calendar-events/CalendarEventDetailPage.tsx` |
| **Development** | `development/AIAgentConfigPage.tsx`, `development/AIAgentsListPage.tsx`, `development/AnalysisReportDetailPage.tsx`, `development/AnalysisReportsPage.tsx`, `development/CodeReviewMetricsPage.tsx`, `development/DevPerformanceComparePage.tsx`, `development/DevPerformanceDashboard.tsx`, `development/DevPerformanceDetailPage.tsx`, `development/PRMetricsDashboard.tsx`, `development/PullRequestsDashboard.tsx`, `development/RefactorInsightsPage.tsx`, `development/StyleGuideChatSettingsPage.tsx`, `development/StyleGuideDetailPage.tsx`, `development/StyleGuidesPage.tsx` |
| **Governance** | `governance/AccessControlPage.tsx`, `governance/AllocationRequestsPage.tsx`, `governance/AreaAccessPage.tsx`, `governance/GovernanceDocumentsPage.tsx`, `governance/GovernanceIndexingPage.tsx`, `governance/GovernanceJiraConfigFormPage.tsx`, `governance/GovernanceJiraIntegrationsListPage.tsx`, `governance/GovernanceMeetingSharePage.tsx`, `governance/MeetingRecordingConfigPage.tsx`, `governance/PlatformSettingsPage.tsx`, `governance/RagConfigPage.tsx`, `governance/UserManagementPage.tsx` |
| **Legacy Code** | `legacy-code/CodeHealthDashboard.tsx`, `legacy-code/CompatibilityPage.tsx`, `legacy-code/MigrationTrackerPage.tsx`, `legacy-code/RefactoringPlansPage.tsx`, `legacy-code/TechDebtRegistryPage.tsx` |
| **Legal** | `legal/PrivacyPolicyPage.tsx`, `legal/TermsOfServicePage.tsx` |
| **Meetings** | `meetings/MeetingDetailPage.tsx`, `meetings/PublicMeetingSharePage.tsx` |
| **Planning** | `planning/FeatureCreationPage.tsx`, `planning/FeatureDetailPage.tsx`, `planning/FeaturesListPage.tsx`, `planning/PlanningDocumentsPage.tsx` |
| **Products** | `products/ProductCreationPage.tsx` |
| **Quality** | `quality/AccessibilityReportsPage.tsx`, `quality/AccessibilityTestPage.tsx`, `quality/AutomatedTestingDashboard.tsx`, `quality/BugDetailPage.tsx`, `quality/BugListPage.tsx`, `quality/BugReportsDashboard.tsx`, `quality/PerformanceReportsPage.tsx`, `quality/PerformanceTestPage.tsx`, `quality/TestCasesPage.tsx`, `quality/TestGeneratorPage.tsx` |
| **Sprints** | `sprints/SprintAnalyticsPage.tsx`, `sprints/SprintDetails.tsx`, `sprints/SprintForm.tsx`, `sprints/SprintTasks.tsx` |
| **Tasks** | `tasks/AISuggestedTasksPage.tsx`, `tasks/TaskEditPage.tsx` |

---

## src/types/

**Path:** `src/types/`

**Purpose:** TypeScript type definitions and interfaces for all data models, API responses, and configuration objects. These types are used throughout the application to ensure type safety.

**Key type files:**

| Category | Files |
|----------|-------|
| **AI Agents** | `agent-config.ts`, `user-ai-config.ts` |
| **Accessibility** | `accessibility-test.ts` |
| **Allocation** | `allocation-request.ts` |
| **Analysis** | `analysis-report.ts`, `code-review-metrics.ts`, `refactor-insight.ts` |
| **Backlog** | `backlog-generation.ts`, `backlog.ts` |
| **Bugs** | `bug.ts` |
| **Calendar** | `calendar-event-mapping.ts`, `calendar-integration.ts`, `meeting-recorder.ts`, `meeting-recording-settings.ts`, `recurring-meeting.ts` |
| **Code Review** | `code-review-metrics.ts` |
| **Development** | `dev-performance.ts`, `dev-task.ts`, `git-repository.ts`, `github-pr-metrics.ts`, `github-pr.ts`, `style-guide-chat-settings.ts`, `style-guide.ts` |
| **Documents** | `centralized-document-types.ts`, `document-save.ts`, `document-types.ts`, `document.ts`, `documents.ts`, `feature-document.ts`, `json-document-types.ts`, `markdown.ts` |
| **Editor** | `editor.ts` |
| **Features** | `feature-attachment.ts`, `feature-creation.ts`, `feature.ts` |
| **Governance** | `governance.ts`, `indexing.ts`, `platform-settings.ts`, `rag-config.ts` |
| **JIRA** | `jira.ts` |
| **Knowledge** | `knowledge.ts` |
| **Legacy Code** | `legacy-code.ts` |
| **Meetings** | `meeting-asset.ts`, `meeting-participant.ts`, `meeting-project.ts`, `meeting-share.ts`, `meeting-view.ts`, `meeting-with-transcript.ts`, `meeting.ts`, `transcript.ts`, `transcription.ts` |
| **Navigation** | `navigation.ts` |
| **Performance** | `error-monitor.ts`, `performance-test.ts`, `test-generator.ts` |
| **Permissions** | `user-access.ts`, `user-area-access.ts`, `user-notification-preferences.ts`, `user-project-access.ts` |
| **Planning** | `prompt.ts`, `suggestions.ts` |
| **Product** | `demo-video.ts`, `enhanced-project.ts` |
| **Projects** | `project-selection.ts`, `project-team-member.ts`, `project-wizard.types.ts`, `project.ts` |
| **Sprints** | `sprint-analytics.ts`, `sprint.ts` |
| **Tasks** | `task-attachment.ts`, `task-comment.ts`, `task-selection.ts` |
| **Team** | `team.ts` |
| **Translations** | `translations.ts` |
| **Users** | `user-admin.ts`, `user-profile.ts` |
| **Index** | `index.ts` -- Barrel export for all types |
| **Declarations** | `markdown.d.ts` -- Markdown module declaration |

---

## src/locales/

**Path:** `src/locales/`

**Purpose:** Internationalization (i18n) translation files. The project supports two locales: Portuguese (Brazil) and English (US). Translations are organized by namespace (feature area) and locale.

**Structure:**
```
src/locales/
|- en-us.ts              # English root entry point
|- pt-br.ts              # Portuguese root entry point
|- modules/              # Feature-specific translation modules
|   |- auth/             # Authentication translations
|   |- backlog/          # Backlog translations
|   |- bugs/             # Bug tracking translations
|   |- calendar/         # Calendar translations
|   |- chat/             # Chat/RAG translations
|   |- core/             # Core UI translations (common, errors, navigation, ui)
|   |- demos/            # Demo page translations
|   |- development/      # Development area translations (aiAgents, analysisReports, codeReviewMetrics, codeRules, devPerformance, prMetrics, pullRequests, refactorInsights, styleGuideChatSettings, styleGuides)
|   |- documents/        # Document translations (convert, documentCard, documents, fileUpload, requirements)
|   |- features/          # Feature translations
|   |- governance/        # Governance area translations (accessControl, aiSettings, allocationRequests, documents, governance, meetingRecordingConfig, meetingShare, permissionsPage, ragConfig, repository, userCreation)
|   `- jira/             # JIRA translations
```

Each module directory contains:
- `en-us/[namespace].ts` -- English translations for that namespace
- `pt-br/[namespace].ts` -- Portuguese translations for that namespace
- `index.ts` -- Barrel export for the module

---

## supabase/functions/

**Path:** `supabase/functions/`

**Purpose:** Deno-based Supabase Edge Functions that run server-side. These handle AI document generation, API endpoints, integrations with external services (JIRA, GitHub, Microsoft Calendar, Recall.ai), and RAG search.

### supabase/functions/_shared/

**Path:** `supabase/functions/_shared/`

**Purpose:** Shared utilities, types, and services reused across all Edge Functions. Organized by domain.

**Key subdirectories:**

| Subdirectory | Purpose |
|-------------|---------|
| `document-generation/` | Shared AI document generation logic (types, prompt-builder, openai-service, ai-interaction-service, generated-document-service, token-extractor, validation, response-builder, openai-helper) |
| `github/` | GitHub API client, pagination, rate limiting, retry logic, types, DB service |
| `indexing/` | RAG indexing content extractors (backlog, feature, generated-document, knowledge-base, meeting, style-guide, task) plus chunking, embeddings, content-extractor-factory |
| `jira/` | JIRA API client, error handling, logging, metrics, DB service (optimized) |
| `pdf-extraction/` | PDF parsing (pdf-parser, text-processor, types) |
| `platform-settings/` | Platform settings loader and service |
| `rag-context/` | RAG context building and configuration |
| `storage/` | Cloud storage abstraction (GCS, S3 providers, factory) |
| `supabase/` | Supabase client and types for Edge Functions |

**Other shared files:**
- `admin-user-types.ts` -- Admin user type definitions
- `api-response-builder.ts` -- Standardized API response formatting
- `batch-processor.ts` -- Batch processing utilities
- `cors.ts` -- CORS headers configuration
- `database-utils.ts` -- Database utility functions
- `developer-matrix/service.ts` -- Developer matrix service
- `encryption.ts` -- Encryption utilities
- `external-service-database.ts` -- External service database operations
- `external-service-types.ts` -- External service type definitions
- `external-service-utils.ts` -- External service utilities
- `field-mapper.ts` -- Field mapping utilities
- `ms-calendar-types.ts` -- Microsoft Calendar types
- `ms-oauth-scopes.ts` -- MS OAuth scope definitions
- `ms-oauth-utils.ts` -- Microsoft OAuth utilities
- `recall-bot-types.ts` -- Recall.ai bot types
- `response-formatter.ts` -- Response formatting
- `transcript-streaming-parser.ts` -- Streaming transcript parsing
- `validation.ts` -- Validation utilities
- `jira-alerts.ts` -- JIRA alert utilities

### supabase/functions/ (top-level Edge Functions)

| Function | Purpose |
|----------|---------|
| `accessibility-test/` | Google PageSpeed API integration for accessibility testing |
| `add-meet-recorder/` | Adds Recall.ai bot to MS Teams meetings |
| `admin-create-user/` | Admin user account creation |
| `admin-soft-delete-user/` | Soft-delete user accounts |
| `analyze-sprint/` | Sprint health analysis via AI |
| `analyze-transcript/` | Meeting transcript AI analysis |
| `api-backlog-items/` | REST API for backlog CRUD (with data-mapper, database-service, request-handler, response-builder, types, validation) |
| `api-docs/` | API documentation serving |
| `api-rag-search/` | RAG-powered semantic search API |
| `api-sprint-details/` | Sprint detail retrieval endpoint |
| `api-sprints-list/` | Sprint listing endpoint |
| `api-task-assign/` | Task assignment endpoint |
| `api-task-details/` | Task detail retrieval |
| `api-task-status/` | Task status update |
| `api-tasks-list/` | Task listing endpoint |
| `api-team-members-list/` | Team member listing |
| `create-meeting-notes/` | AI generates structured meeting notes from transcript |
| `create-prd/` | AI generates Product Requirements Document |
| `create-technical-specs/` | AI generates technical specifications |
| `create-test-cases/` | AI generates test cases from requirements |
| `create-unit-tests/` | AI generates unit tests |
| `create-user-story/` | AI generates user stories |
| `extract-pdf/` | PDF content extraction |
| `generate-presigned-download-url/` | Generates secure presigned download URLs |
| `microsoft-calendar-integration/` | MS Calendar OAuth and event sync |
| `process-transcript/` | Meeting transcript processing pipeline |
| `recall-bot-create/` | Creates Recall.ai bot for meeting recording |
| `recall-bot-list/` | Lists Recall.ai bots |
| `recall-transcript/` | Retrieves transcript from Recall.ai |
| `recall-webhook/` | Handles Recall.ai webhook events |
| `search/` | RAG search endpoint |
| `search-engine/` | Core search engine logic |
| `sync-github-pr/` | Synchronizes GitHub pull requests |
| `sync-jira/` | Synchronizes JIRA issues |

---

## docs/

**Path:** `docs/`

**Purpose:** Comprehensive project documentation covering architecture, features, APIs, integration guides, governance, and product planning.

**Key directories:**

| Directory | Purpose |
|-----------|---------|
| `api/` | API endpoint documentation (accessibility-test, backlog-items, calendar-integration, sprint endpoints, task endpoints, team-members, document-generation, creating-new-document-generation-function, api-documentation-guide) |
| `Code Rules/` | Coding standards (frontend-style-guide.md, sql-style-guide.md) |
| `edge-functions/` | Edge Function documentation (SUPABASE-DOCS-INDEX, ms-calendar-sync, user creation) |
| `features/` | Feature documentation (TEST_GENERATOR_USER_GUIDE, github-pr-sync, i18n-implementation-guide, presigned-upload-implementation, style-guide-chat-system, voice-task-generation-chatgpt, console-boundary-implementation, external-service-utils) |
| `frontend/` | Frontend documentation (COLOR_USAGE_GUIDE.md) |
| `funcional/` | Functional feature documentation in Portuguese (area-specific features: PLANNING, DEVELOPMENT, QUALITY, GOVERNANCE, meetings, MENU) |
| `governanca-informations/` | Governance reference materials in Portuguese (regulatory landscape, risk/security, governance frameworks, organizational impact, market trends) |
| `governance-templates/` | Governance policy templates in Portuguese (access policy, compliance, privacy, data protection, security, usage) |
| `integrations/` | Integration documentation (INDEX, dr-media-tools-integration) |
| `jira/` | JIRA integration documentation (jira-api-endpoints.md, jira-integration-setup.md) |
| `knowledge-base/` | Project knowledge base content (objetivos: strategic indicators, annual goals, mission/vision/values, OKRs, strategic priorities; processos: customer service, software development, incident management, onboarding; recursos-e-ferramentas) |
| `product/` | Product planning documentation in Portuguese (0-8: benefits summary, architecture, requirements, task elaboration, autonomous agents implementation, quality, maintenance, onboarding, knowledge management; area-specific usage-oriented features) |
| `rag/` | RAG system documentation (indexing-system-documentation, rag-content-type-column-proposal, rag-phase1-metadata-enhancement, task-indexing-migration, generate-embeddings) |

**Root-level docs:**
- `PROJECT_INDEX.md` -- Project documentation index
- `Features - 2026-03-23.md` -- Feature list
- `Product Backlog Items - 2026-03-23.md` -- Product backlog
- `TEST_COMMANDS.md` -- Test command reference
- `AI_Settings_Management.md` -- AI settings management
- `analysis-reports-formats.json` -- Analysis report format definitions
- `create-documents-curl.md` -- curl examples for document generation
- `openai-api-responses.ts` -- OpenAI Responses API documentation
- `payload-backlog.json` -- Backlog payload examples
- `backlog-normalized-record.md` -- Backlog normalized record format
- `feature-normalized-record.md` -- Feature normalized record format
- `centralized-document-types-plan.md` -- Document types centralization plan
- `TECHNICAL_PLAN_TEAM_PROJECT_DOCS.md` -- Technical planning document
- `api_ACCESSIBILITY.md` -- Accessibility API documentation

---

## Configuration Files

### package.json

**Path:** `package.json`

**Purpose:** NPM package manifest defining project metadata, scripts, and dependencies.

**Key scripts:**
- `npm run dev` -- Start development server on port 8080
- `npm run build` -- Production build
- `npm run build:dev` -- Development build with source maps
- `npm run lint` -- Run ESLint
- `npm run preview` -- Preview production build
- `npm run test` -- Unit tests via Vitest
- `npm run test:coverage` -- Test coverage report
- `npm run test:integration` -- Integration tests
- `npm run test:e2e` -- Playwright E2E tests
- `npm run test:e2e:ci` -- CI E2E tests with JSON/HTML/JUnit reporters
- `npm run test:accessibility` -- Accessibility E2E tests
- `npm run test:performance` -- Performance E2E tests
- `npm run test:visual` -- Visual regression tests
- `npm run test:all` -- Full test suite (unit + E2E)

### tsconfig.json

**Path:** `tsconfig.json`

**Purpose:** Root TypeScript configuration. Sets up path aliases (`@/*` maps to `./src/*`), progressive strict mode settings, and references `tsconfig.app.json` and `tsconfig.node.json`.

**Key settings:**
- `baseUrl: "."` with `paths: { "@/*": ["./src/*"] }` -- Path alias configuration
- `noImplicitAny: true` -- Catches untyped variables
- `strictNullChecks: true` -- Prevents null/undefined errors
- `noUnusedLocals: true` -- Enforces clean code
- `noUnusedParameters: true` -- Enforces clean parameter usage

### tsconfig.app.json

**Path:** `tsconfig.app.json`

**Purpose:** TypeScript configuration for the React application source code.

**Key settings:**
- `target: ES2020`, `lib: ["ES2020", "DOM", "DOM.Iterable"]` -- ES2020 with DOM types
- `module: ESNext` -- Modern ES modules
- `jsx: react-jsx` -- React JSX transform
- `moduleResolution: bundler` -- Bundler-style module resolution
- `strict: false` -- Kept false for gradual migration (while selective strict flags are enabled)

### tsconfig.node.json

**Path:** `tsconfig.node.json`

**Purpose:** TypeScript configuration for Node.js build tools (Vite, ESLint).

### vite.config.ts

**Path:** `vite.config.ts`

**Purpose:** Vite bundler configuration.

**Key features:**
- Server on host `::`, port `8080`
- `@` alias to `./src`
- Plugin stack: `wasm()`, `topLevelAwait()`, `react()` (SWC), and `componentTagger()` (dev mode only for bundle analysis)
- Manual chunk splitting: `react-vendor`, `ui-vendor` (Radix), `form-vendor` (react-hook-form), `query-vendor` (TanStack Query), `supabase-vendor`, `monaco-editor`, `shadcn-ui`
- Chunk size warning threshold: 1000 KB

### tailwind.config.ts

**Path:** `tailwind.config.ts`

**Purpose:** Tailwind CSS theme configuration.

**Key features:**
- Dark mode via `class` selector
- Content paths: `./pages/**`, `./components/**`, `./app/**`, `./src/**`
- CSS variable-based color system (primary, secondary, destructive, muted, accent, popover, card, sidebar)
- Area-specific color tokens: `planning` (gold), `development` (gray), `testing` (bronze), `governance` (green), `phase` (CSS variable)
- Custom keyframe animations: `accordion-down`, `accordion-up`
- Plugins: `tailwindcss-animate`, `@tailwindcss/typography`

### postcss.config.js

**Path:** `postcss.config.js`

**Purpose:** PostCSS configuration. Registers Tailwind CSS and Autoprefixer plugins.

### eslint.config.js

**Path:** `eslint.config.js`

**Purpose:** ESLint flat-config configuration for TypeScript and React.

**Key rules:**
- Extends ESLint recommended + TypeScript-ESLint recommended
- React Hooks rules from `eslint-plugin-react-hooks`
- `react-refresh/only-export-components` as a warning
- `@typescript-eslint/no-unused-vars` disabled (handled by TypeScript)

### vitest.config.ts

**Path:** `vitest.config.ts`

**Purpose:** Vitest unit test configuration.

**Key features:**
- Environment: `jsdom`
- Setup file: `./src/tests/setup.ts`
- Coverage provider: `v8` with thresholds (branches 75%, functions/lines/statements 80%)
- Timeouts: test 30s, hook 30s, teardown 10s
- `@` alias to `./src`
- `process.env` mock for tests

### components.json

**Path:** `components.json`

**Purpose:** Shadcn/ui component registry. Defines where components are stored and how they are managed by the Shadcn CLI.

---

## Directory Purpose Summary

| Directory | Purpose |
|-----------|---------|
| `src/components/ui/` | Shadcn/ui base components -- reusable atomic UI building blocks |
| `src/components/projects/` | Project management components -- access control, collaboration, wizard |
| `src/contexts/` | React Context providers -- auth, project selection, team state |
| `src/hooks/` | Custom hooks -- TanStack Query wrappers for all feature data fetching |
| `src/lib/openai*.ts` | OpenAI integration -- document generation, conversation tracking |
| `src/lib/services/` | Service classes -- business logic and Supabase database operations |
| `src/lib/utils/` | Pure utility functions -- formatting, validation, date handling |
| `src/lib/rag/` | RAG implementation -- vector storage, embeddings, search, chat |
| `src/pages/` | Route page components -- full page layouts for each URL |
| `src/types/` | TypeScript type definitions -- data models, API types, config types |
| `src/locales/` | i18n translations -- Portuguese (pt-br) and English (en-us) |
| `supabase/functions/_shared/` | Edge Function shared utilities -- reusable across all functions |
| `supabase/functions/*/` | Edge Functions -- AI document generation, APIs, integrations |
| `docs/` | Project documentation -- architecture, features, APIs, governance, product |
