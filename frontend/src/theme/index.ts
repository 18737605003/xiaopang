import { ThemeConfig } from 'antd';

const sharedFontFamily =
  'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans SC", sans-serif';

// 浅色主题 - 简洁商务风
export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1677ff',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorInfo: '#1677ff',
    colorTextBase: '#1d2129',
    colorBgBase: '#ffffff',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: sharedFontFamily,
    colorBgLayout: '#f7f8fa',
    colorBorderSecondary: '#e5e6eb',
    controlHeight: 36,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 56,
      siderBg: '#0b1526',
      bodyBg: '#f7f8fa',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkItemSelectedBg: 'rgba(22, 119, 255, 0.15)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
      darkItemSelectedColor: '#4096ff',
      itemMarginInline: 8,
      itemBorderRadius: 6,
      itemHeight: 40,
    },
    Card: {
      borderRadiusLG: 10,
      boxShadowTertiary: '0 1px 2px 0 rgba(0,0,0,0.03), 0 1px 6px -1px rgba(0,0,0,0.02), 0 2px 4px 0 rgba(0,0,0,0.02)',
      paddingLG: 20,
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      controlHeightLG: 44,
      fontWeight: 500,
    },
    Input: {
      borderRadius: 8,
      controlHeight: 36,
      controlHeightLG: 44,
    },
    Table: {
      headerBg: '#fafbfc',
      headerColor: '#86909c',
      rowHoverBg: '#f7f8fa',
      headerSplitColor: 'transparent',
      borderColor: '#f2f3f5',
      cellPaddingBlock: 14,
    },
    Breadcrumb: {
      itemColor: '#86909c',
      lastItemColor: '#1d2129',
      separatorColor: '#c9cdd4',
    },
    Tabs: {
      inkBarColor: '#1677ff',
      itemSelectedColor: '#1677ff',
      itemHoverColor: '#4096ff',
    },
    Modal: {
      borderRadiusLG: 12,
    },
    Select: {
      borderRadius: 8,
    },
  },
};

// 深色主题 - 简洁商务风
export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#3c89e8',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    colorInfo: '#3c89e8',
    colorTextBase: '#ffffffd9',
    colorBgBase: '#17171a',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: sharedFontFamily,
    colorBgLayout: '#0f0f12',
    colorBorderSecondary: '#2e2e32',
    controlHeight: 36,
    wireframe: false,
  },
  components: {
    Layout: {
      headerBg: '#1d1d21',
      headerHeight: 56,
      siderBg: '#0f0f12',
      bodyBg: '#0f0f12',
    },
    Menu: {
      darkItemBg: 'transparent',
      darkItemSelectedBg: 'rgba(60, 137, 232, 0.15)',
      darkItemHoverBg: 'rgba(255, 255, 255, 0.06)',
      darkItemSelectedColor: '#6aa1e8',
      itemMarginInline: 8,
      itemBorderRadius: 6,
      itemHeight: 40,
    },
    Card: {
      borderRadiusLG: 10,
      boxShadowTertiary: '0 1px 2px 0 rgba(0,0,0,0.2), 0 1px 6px -1px rgba(0,0,0,0.12)',
      paddingLG: 20,
    },
    Button: {
      borderRadius: 8,
      controlHeight: 36,
      controlHeightLG: 44,
      fontWeight: 500,
    },
    Input: {
      borderRadius: 8,
      controlHeight: 36,
      controlHeightLG: 44,
    },
    Table: {
      headerBg: '#1d1d21',
      headerColor: '#86909c',
      rowHoverBg: '#1d1d21',
      headerSplitColor: 'transparent',
      borderColor: '#2e2e32',
      cellPaddingBlock: 14,
    },
    Breadcrumb: {
      itemColor: '#86909c',
      lastItemColor: '#ffffffd9',
      separatorColor: '#484849',
    },
    Tabs: {
      inkBarColor: '#3c89e8',
      itemSelectedColor: '#3c89e8',
      itemHoverColor: '#6aa1e8',
    },
    Modal: {
      borderRadiusLG: 12,
    },
    Select: {
      borderRadius: 8,
    },
  },
};
