<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, nextTick, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useI18n } from '@n8n/i18n';
import { N8nScrollArea, N8nResizeWrapper, type IMenuItem } from '@n8n/design-system';
import { VIEWS } from '@/app/constants';
import { hasPermission } from '@/app/utils/rbac/permissions';
import { useRootStore } from '@n8n/stores/useRootStore';
import { useCloudPlanStore } from '@n8n/stores/cloudPlan.store';
import { useSettingsStore } from '@n8n/stores/settings.store';
import { useUIStore } from '@/app/stores/ui.store';
import { usePageRedirectionHelper } from '@/app/composables/usePageRedirectionHelper';
import { useKeybindings } from '@/app/composables/useKeybindings';
import {
	MAX_SIDEBAR_WIDTH,
	MIN_SIDEBAR_WIDTH,
	useSidebarLayout,
} from '@/app/composables/useSidebarLayout';
import MainSidebarHeader from '@/app/components/MainSidebarHeader.vue';
import BottomMenu from '@/app/components/BottomMenu.vue';
import MainSidebarSourceControl from '@/app/components/MainSidebarSourceControl.vue';
import ProjectNavigation from '@/features/collaboration/projects/components/ProjectNavigation.vue';
import { useResourceCenterStore } from '@/experiments/resourceCenter/stores/resourceCenter.store';
import { LOCAL_STORAGE_SIDEBAR_WIDTH } from '@/app/constants';
import { useSidebarExpandedExperiment } from '@/experiments/sidebarExpanded';
import { useSettingsItems } from '@/app/composables/useSettingsItems';

const cloudPlanStore = useCloudPlanStore();
const rootStore = useRootStore();
const settingsStore = useSettingsStore();
const uiStore = useUIStore();
const resourceCenterStore = useResourceCenterStore();

const i18n = useI18n();
const router = useRouter();
const pageRedirectionHelper = usePageRedirectionHelper();

const { applyExperiment: applySidebarExpandedExperiment } = useSidebarExpandedExperiment();
applySidebarExpandedExperiment();

// RC-1: auto-expand sidebar once if not already expanded
if (resourceCenterStore.shouldAutoExpandSidebar) {
	if (uiStore.sidebarMenuCollapsed) {
		uiStore.sidebarMenuCollapsed = false;
		localStorage.setItem(LOCAL_STORAGE_SIDEBAR_WIDTH, '200');
	}
	resourceCenterStore.markSidebarAutoExpanded();
}

const {
	isCollapsed,
	isResizing,
	sidebarWidth,
	onResizeStart,
	onResize,
	onResizeEnd,
	toggleCollapse,
} = useSidebarLayout();

const isResourceCenterEnabled = computed(() => resourceCenterStore.isFeatureEnabled());

const { settingsItems } = useSettingsItems();

const mainMenuItems = computed<IMenuItem[]>(() => [
	{
		id: 'cloud-admin',
		position: 'bottom',
		label: 'Admin Panel',
		icon: 'cloud',
		available: settingsStore.isCloudDeployment && hasPermission(['instanceOwner']),
	},
	{
		// Resource Center - replaces Templates when experiment is enabled
		id: 'resource-center',
		icon: { type: 'icon', value: 'lightbulb', color: 'primary' },
		label: i18n.baseText('experiments.resourceCenter.sidebar'),
		position: 'bottom',
		available: isResourceCenterEnabled.value,
		route: { to: { name: VIEWS.RESOURCE_CENTER } },
	},
	{
		id: 'insights',
		icon: 'chart-column-decreasing',
		label: 'Insights',
		position: 'bottom',
		route: { to: { name: VIEWS.INSIGHTS } },
		available:
			settingsStore.isModuleActive('insights') &&
			hasPermission(['rbac'], { rbac: { scope: 'insights:list' } }),
	},
	{
		id: 'settings',
		icon: 'settings',
		label: i18n.baseText('mainSidebar.settings'),
		position: 'bottom',
		children: settingsItems.value,
	},
]);

const visibleMenuItems = computed<IMenuItem[]>(() =>
	mainMenuItems.value
		.filter((item) => item.available !== false)
		.map((item) => ({
			...item,
			children: item.children?.filter((child) => child.available !== false),
		})),
);

const checkOverflow = () => {
	const position = scrollAreaRef.value?.getScrollPosition();
	if (position && scrollAreaRef.value?.$el) {
		const element = scrollAreaRef.value.$el as HTMLElement;
		const hasVerticalOverflow = position.height > element.clientHeight;
		hasOverflow.value = hasVerticalOverflow;
		// Check if scrolled from top - only show border if there's overflow AND scrolled
		hasScrolledFromTop.value = hasVerticalOverflow && position.top > 0;
	}
};

// Re-check overflow when sidebar collapse state changes
watch(isCollapsed, () => {
	void nextTick(() => {
		checkOverflow();
	});
});

onMounted(() => {
	basePath.value = rootStore.baseUrl;

	void nextTick(() => {
		checkOverflow();

		if (scrollAreaRef.value?.$el) {
			const element = scrollAreaRef.value.$el as HTMLElement;
			resizeObserver = new ResizeObserver(() => {
				checkOverflow();
			});
			resizeObserver.observe(element);
			checkOverflow();
		}
	});

	window.addEventListener('resize', checkOverflow);
});

onBeforeUnmount(() => {
	if (resizeObserver) {
		resizeObserver.disconnect();
		resizeObserver = null;
	}

	window.removeEventListener('resize', checkOverflow);
});

const scrollAreaRef = ref<InstanceType<typeof N8nScrollArea>>();
const hasOverflow = ref(false);
const hasScrolledFromTop = ref(false);
let resizeObserver: ResizeObserver | null = null;
const basePath = ref('');

const handleSelect = (key: string) => {
	switch (key) {
		case 'cloud-admin': {
			void pageRedirectionHelper.goToDashboard();
			break;
		}
		case 'insights':
			break;
		default:
			break;
	}
};

const onLogout = () => {
	void router.push({ name: VIEWS.SIGNOUT });
};

useKeybindings({
	['bracketleft']: () => toggleCollapse(),
});
</script>

<template>
	<N8nResizeWrapper
		id="side-menu"
		:class="{
			[$style.sideMenu]: true,
			[$style.sideMenuCollapsed]: isCollapsed,
			[$style.sideMenuResizing]: isResizing,
		}"
		:width="sidebarWidth"
		:style="isCollapsed ? {} : { width: `${sidebarWidth}px` }"
		:supported-directions="['right']"
		:min-width="MIN_SIDEBAR_WIDTH"
		:max-width="MAX_SIDEBAR_WIDTH"
		:grid-size="8"
		@resizestart="onResizeStart"
		@resize="onResize"
		@resizeend="onResizeEnd"
	>
		<MainSidebarHeader
			:is-collapsed="isCollapsed"
			@collapse="toggleCollapse"
		/>
		<div
			:class="{
				[$style.scrollAreaWrapper]: true,
			}"
		>
			<N8nScrollArea @scroll-capture="checkOverflow">
				<ProjectNavigation
					:collapsed="isCollapsed"
					:plan-name="cloudPlanStore.currentPlanData?.displayName"
				/>
			</N8nScrollArea>
		</div>
		<BottomMenu
			:items="visibleMenuItems"
			:is-collapsed="isCollapsed"
			@logout="onLogout"
			@select="handleSelect"
		/>
		<MainSidebarSourceControl :is-collapsed="isCollapsed" />
	</N8nResizeWrapper>
</template>

<style lang="scss" module>
@use '@/app/css/variables' as *;

.sideMenu {
	position: relative;
	height: 100%;
	display: flex;
	flex-direction: column;
	border-right: var(--border);
	background-color: var(--menu--color--background, var(--color--background--light-2));
	transition: width var(--duration--snappy) var(--easing--ease-out);
	will-change: width;

	&.sideMenuCollapsed {
		width: $sidebar-width;
		min-width: auto;
	}

	&.sideMenuResizing {
		transition: none;
	}
}

.scrollAreaWrapper {
	position: relative;
	flex: 1;
	min-height: 0;
	display: flex;
	flex-direction: column;
	padding-top: var(--spacing--2xs);
}

.scrollAreaWrapperWithBottomBorder {
	border-bottom: var(--border);
}

.scrollAreaWrapperWithTopBorder {
	border-top: var(--border);
}
</style>
