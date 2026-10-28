import { reactive } from 'vue';
import { createComponentRenderer } from '@/__tests__/render';
import { createTestingPinia } from '@pinia/testing';
import { type MockedStore, mockedStore } from '@/__tests__/utils';
import { defaultSettings } from '@n8n/frontend-test-utils';
import MainSidebar from '@/app/components/MainSidebar.vue';
import { useSettingsStore } from '@n8n/stores/settings.store';
import { useUIStore } from '@/app/stores/ui.store';
import { useResourceCenterStore } from '@/experiments/resourceCenter/stores/resourceCenter.store';
import { VIEWS } from '@/app/constants';
import { hasPermission } from '@/app/utils/rbac/permissions';

vi.mock('vue-router', () => ({ useRouter: vi.fn(() => ({ resolve: vi.fn() })), useRoute: vi.fn(() => ({})), RouterLink: vi.fn() }));
vi.mock('@/app/composables/useSettingsItems', () => ({
	useSettingsItems: vi.fn(() => ({
		settingsItems: reactive([{ id: 'settings-personal', available: true }]),
	})),
}));
vi.mock('@/app/utils/rbac/permissions', () => ({ hasPermission: vi.fn(() => false) }));

let renderComponent: ReturnType<typeof createComponentRenderer>;
let settingsStore: MockedStore<typeof useSettingsStore>;
let uiStore: MockedStore<typeof useUIStore>;
let resourceCenterStore: MockedStore<typeof useResourceCenterStore>;

describe('MainSidebar', () => {
	beforeEach(() => {
		renderComponent = createComponentRenderer(MainSidebar, {
			pinia: createTestingPinia(),
		});
		settingsStore = mockedStore(useSettingsStore);
		uiStore = mockedStore(useUIStore);
		resourceCenterStore = mockedStore(useResourceCenterStore);

		settingsStore.settings = defaultSettings;
		uiStore.sidebarMenuCollapsed = false;
		resourceCenterStore.isFeatureEnabled = vi.fn(() => false);
		resourceCenterStore.shouldAutoExpandSidebar = false;
		vi.mocked(hasPermission).mockReturnValue(false);
	});

	it('renders the sidebar without error', () => {
		expect(() => renderComponent()).not.toThrow();
	});

	describe('mainMenuItems', () => {
		it('should show cloud-admin menu item when user is instance owner on cloud deployment', () => {
			settingsStore.isCloudDeployment = true;
			vi.mocked(hasPermission).mockReturnValue(true);
			const { getByTestId } = renderComponent();
			expect(getByTestId('main-sidebar-cloud-admin')).toBeInTheDocument();
		});

		it('should not show cloud-admin menu item when not on cloud deployment', () => {
			settingsStore.isCloudDeployment = false;
			const { queryByTestId } = renderComponent();

			expect(queryByTestId('main-sidebar-cloud-admin')).not.toBeInTheDocument();
		});

		it('should show resource-center menu item when feature is enabled', () => {
			resourceCenterStore.isFeatureEnabled = vi.fn(() => true);

			const { getByTestId } = renderComponent();

			expect(getByTestId('main-sidebar-resource-center')).toBeInTheDocument();
		});

		it('should not show resource-center menu item when feature is disabled', () => {
			const { queryByTestId } = renderComponent();

			expect(queryByTestId('main-sidebar-resource-center')).not.toBeInTheDocument();
		});

		it('should show insights menu item when module is active and user has permission', () => {
			settingsStore.isModuleActive = vi.fn().mockReturnValue(true);
			vi.mocked(hasPermission).mockReturnValue(true);

			const { getByTestId } = renderComponent();

			expect(getByTestId('main-sidebar-insights')).toBeInTheDocument();
		});

		it('should not show insights menu item when module is not active', () => {
			settingsStore.isModuleActive = vi.fn().mockReturnValue(false);

			const { queryByTestId } = renderComponent();

			expect(queryByTestId('main-sidebar-insights')).not.toBeInTheDocument();
		});

		it('should show settings menu item with children', () => {
			const { getByTestId } = renderComponent();

			expect(getByTestId('main-sidebar-settings')).toBeInTheDocument();
		});
	});

	describe('handleSelect', () => {
		beforeEach(() => {
			vi.spyOn(uiStore, 'openModal');
			vi.spyOn(uiStore, 'openModalWithData');
		});

		it('should navigate to cloud admin dashboard when cloud-admin is selected', async () => {
			vi.mocked(hasPermission).mockReturnValue(true);
			settingsStore.isCloudDeployment = true;
			const { getByTestId } = renderComponent();

			getByTestId('main-sidebar-cloud-admin').click();

			expect(uiStore.openModal).not.toHaveBeenCalled();
		});
	});
});
