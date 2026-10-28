import { nextTick, ref } from 'vue';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createTestingPinia } from '@pinia/testing';
import { waitFor } from '@testing-library/vue';
import { AGENTS_N8N_CHAT_FLAG } from '@n8n/api-types';
import { TELEMETRY_EVENT } from '@n8n/telemetry';
import { promotionEventBus } from '@/features/integrations/promotions.ee/promotions.eventBus';
import { createComponentRenderer } from '@/__tests__/render';
import { mockedStore } from '@/__tests__/utils';
import { usePostHog } from '@/app/stores/posthog.store';
import { createProjectListItem, createTestProject } from '../__tests__/utils';
import ProjectsNavigation from './ProjectNavigation.vue';
import { useProjectsStore } from '../projects.store';
import { useSettingsStore } from '@n8n/stores/settings.store';
import { useUsersStore } from '@n8n/stores/users.store';
import { useRBACStore } from '@n8n/stores/rbac.store';
import { AGENT_N8N_CHAT_VIEW } from '@/features/agents/constants';
import { useAgentN8nChatThreadsStore } from '@/features/agents/n8nChatPage/n8nChatThreads.store';

const trackMock = vi.fn();
vi.mock('@n8n/composables/useTelemetry', () => ({
	useTelemetry: () => ({ track: trackMock }),
}));

// A real ref — reactive watchers in the component and `useRecentChats` must see this
// change after mount, which a plain `{ value }` object wouldn't trigger.
const n8nChatFlagRef = ref(false);
vi.mock('@/features/agents/composables/useAgentsN8nChatFlag', () => ({
	useAgentsN8nChatFlag: () => n8nChatFlagRef,
}));

vi.mock('vue-router', async () => {
	const actual = await vi.importActual('vue-router');
	const push = vi.fn();
	return {
		...actual,
		useRouter: () => ({
			push,
		}),
		RouterLink: {
			template: '<a><slot /></a>',
		},
	};
});

vi.mock('@n8n/composables/useToast', () => {
	const showMessage = vi.fn();
	const showError = vi.fn();
	return {
		useToast: () => ({
			showMessage,
			showError,
		}),
	};
});

vi.mock('@/app/composables/usePageRedirectionHelper', () => {
	const goToUpgrade = vi.fn();
	return {
		usePageRedirectionHelper: () => ({
			goToUpgrade,
		}),
	};
});

vi.mock('@n8n/i18n', async (importActual) => ({
	...(await importActual()),
	useI18n: () => ({
		baseText: (key: string, fallback?: string) => {
			const mocks: Record<string, string> = {
				'projects.menu.title': 'Projects',
			};
			return mocks[key] || fallback || key;
		},
	}),
}));

const renderComponent = createComponentRenderer(ProjectsNavigation, {
	global: {
		plugins: [
			createRouter({
				history: createMemoryHistory(),
				routes: [
					{
						path: '/',
						name: 'home',
						component: { template: '<div>Home</div>' },
					},
				],
			}),
		],
	},
});

// A router that can sit on a chat route; the default renderer only knows `home`.
const threadRouter = createRouter({
	history: createMemoryHistory(),
	routes: [
		{ path: '/', name: 'home', component: { template: '<div>Home</div>' } },
		{
			path: '/assistant/agents/:agentId/:agentThreadId?',
			name: AGENT_N8N_CHAT_VIEW,
			component: { template: '<div>Agent thread</div>' },
		},
	],
});
const renderOnThreadRoute = createComponentRenderer(ProjectsNavigation, {
	global: { plugins: [threadRouter] },
});

let projectsStore: ReturnType<typeof mockedStore<typeof useProjectsStore>>;
let settingsStore: ReturnType<typeof mockedStore<typeof useSettingsStore>>;
let usersStore: ReturnType<typeof mockedStore<typeof useUsersStore>>;

const personalProjects = Array.from({ length: 3 }, createProjectListItem);
const teamProjects = Array.from({ length: 3 }, () => createProjectListItem('team'));

describe('ProjectsNavigation', () => {
	beforeEach(() => {
		vi.stubGlobal('localStorage', {
			getItem: vi.fn().mockReturnValue(null),
			setItem: vi.fn(),
		});
		createTestingPinia();

		projectsStore = mockedStore(useProjectsStore);
		settingsStore = mockedStore(useSettingsStore);
		usersStore = mockedStore(useUsersStore);
		trackMock.mockReset();
		n8nChatFlagRef.value = false;
	});

	function enableFlag() {
		n8nChatFlagRef.value = true;
		// createTestingPinia stubs every store function (including `getVariant`) as a
		// no-op, so the telemetry payload's variant string must be forced this way too.
		mockedStore(usePostHog).getVariant.mockImplementation((flag) =>
			flag === AGENTS_N8N_CHAT_FLAG ? 'variant-a' : undefined,
		);
	}

	it('should not throw an error', () => {
		projectsStore.teamProjectsLimit = -1;
		expect(() => {
			renderComponent({
				props: {
					collapsed: false,
				},
			});
		}).not.toThrow();
	});

	it('should reload the projects after a package was applied', async () => {
		projectsStore.teamProjectsLimit = -1;
		renderComponent({ props: { collapsed: false } });
		// The listener registers once the users are fetched.
		await waitFor(() => expect(usersStore.fetchUsers).toHaveBeenCalled());
		await nextTick();

		promotionEventBus.emit('applied', { projectId: 'project-1' });

		await waitFor(() => expect(projectsStore.getMyProjects).toHaveBeenCalled());
	});

	it('should reload the projects after a package removed one', async () => {
		projectsStore.teamProjectsLimit = -1;
		renderComponent({ props: { collapsed: false } });
		await waitFor(() => expect(usersStore.fetchUsers).toHaveBeenCalled());
		await nextTick();

		promotionEventBus.emit('projectRemoved', { projectId: 'project-1' });

		await waitFor(() => expect(projectsStore.getMyProjects).toHaveBeenCalled());
	});

	it('should show "Projects" title and Personal project when the feature is enabled', async () => {
		projectsStore.teamProjectsLimit = -1;
		projectsStore.myProjects = [...personalProjects, ...teamProjects];
		projectsStore.personalProject = createTestProject({ type: 'personal' });

		const { getAllByTestId, getByTestId, queryByText } = renderComponent({
			props: {
				collapsed: false,
			},
		});

		expect(queryByText('Projects')).toBeVisible();
		expect(getByTestId('project-personal-menu-item')).toBeVisible();
		expect(getByTestId('project-personal-menu-item').querySelector('svg')).toBeVisible();
		expect(getAllByTestId('project-menu-item')).toHaveLength(teamProjects.length);
	});

	it('should not show "Projects" title when the menu is collapsed', async () => {
		projectsStore.teamProjectsLimit = -1;

		const { queryByText } = renderComponent({
			props: {
				collapsed: true,
			},
		});

		expect(queryByText('Projects')).not.toBeInTheDocument();
	});

	it('should not show "Projects" title when the feature is not enabled', async () => {
		projectsStore.teamProjectsLimit = 0;

		const { queryByText } = renderComponent({
			props: {
				collapsed: false,
			},
		});

		expect(queryByText('Projects')).not.toBeInTheDocument();
	});

	it('should show Personal project when folders are enabled but projects are disabled', async () => {
		projectsStore.teamProjectsLimit = 0;
		settingsStore.isFoldersFeatureEnabled = true;
		projectsStore.personalProject = createTestProject({ type: 'personal' });

		const { queryByText, getByTestId, queryByTestId } = renderComponent({
			props: {
				collapsed: false,
			},
		});

		// Personal project menu item should be visible
		expect(getByTestId('project-personal-menu-item')).toBeVisible();
		// Projects section should not be visible
		expect(queryByText('Projects')).not.toBeInTheDocument();
		expect(queryByTestId('project-plus-button')).not.toBeInTheDocument();
	});

	it('should show project icons when the menu is collapsed', async () => {
		projectsStore.teamProjectsLimit = -1;
		projectsStore.personalProject = createTestProject({ type: 'personal' });

		const { getByTestId } = renderComponent({
			props: {
				collapsed: true,
			},
		});

		expect(getByTestId('project-personal-menu-item')).toBeVisible();
		expect(getByTestId('project-personal-menu-item').querySelector('svg')).toBeInTheDocument();
	});

	it('should show projects section when there are projects', async () => {
		projectsStore.teamProjectsLimit = -1;
		projectsStore.myProjects = [...teamProjects];

		const { getByText } = renderComponent({
			props: {
				collapsed: false,
			},
		});

		expect(getByText('Projects')).toBeVisible();
	});

	it('should render a fallback icon for projects with no icon set', async () => {
		projectsStore.teamProjectsLimit = -1;
		const projectWithoutIcon = createProjectListItem('team');
		projectWithoutIcon.icon = null;
		projectsStore.myProjects = [projectWithoutIcon];

		const { getAllByTestId } = renderComponent({
			props: {
				collapsed: false,
			},
		});

		const items = getAllByTestId('project-menu-item');
		expect(items).toHaveLength(1);
		expect(items[0].querySelector('svg')).toBeInTheDocument();
	});

	it('should not render shared menu item when only one verified user', async () => {
		// Only one verified user
		usersStore.allUsers = [
			{ id: '1', isPendingUser: false, isDefaultUser: false, mfaEnabled: false },
			{ id: '2', isPendingUser: true, isDefaultUser: false, mfaEnabled: false },
		];
		projectsStore.teamProjectsLimit = -1;
		projectsStore.isTeamProjectFeatureEnabled = true;

		const { queryByTestId } = renderComponent({
			props: {
				collapsed: false,
			},
		});

		// The shared menu item should not be rendered
		expect(queryByTestId('project-shared-menu-item')).not.toBeInTheDocument();
	});

	it('should render shared menu item when more than one verified user', async () => {
		// Only one verified user
		usersStore.allUsers = [
			{ id: '1', isPendingUser: false, isDefaultUser: false, mfaEnabled: false },
			{ id: '2', isPendingUser: true, isDefaultUser: false, mfaEnabled: false },
			{ id: '3', isPendingUser: false, isDefaultUser: false, mfaEnabled: false },
		];
		projectsStore.teamProjectsLimit = -1;
		projectsStore.isTeamProjectFeatureEnabled = true;

		const { getByTestId } = renderComponent({
			props: {
				collapsed: false,
			},
		});

		// The shared menu item should not be rendered
		expect(getByTestId('project-shared-menu-item')).toBeInTheDocument();
	});
});