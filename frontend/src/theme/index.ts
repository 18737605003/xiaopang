import { ThemeConfig } from 'antd';

// 浅色主题
export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#0050b3',
    colorSuccess: '#13c2c2',
    colorWarning: '#fa8c16',
    colorError: '#f5222d',
    colorInfo: '#0050b3',
    colorTextBase: '#262626',
    colorBgBase: '#ffffff',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 64,
      siderBg: '#001529',
      bodyBg: '#f5f5f5',
    },
    Menu: {
      darkItemBg: '#001529',
      darkItemSelectedBg: '#0050b3',
      darkItemHoverBg: '#1d3a5f',
    },
    Card: {
      borderRadiusLG: 8,
      boxShadowTertiary: '0 2px 8px rgba(0, 0, 0, 0.08)',
    },
    Button: {
      borderRadius: 6,
      controlHeight: 40,
      controlHeightLG: 48,
    },
    Input: {
      borderRadius: 6,
      controlHeight: 40,
      controlHeightLG: 48,
    },
    Table: {
      headerBg: '#fafafa',
      headerColor: '#262626',
      rowHoverBg: '#e6f7ff',
    },
  },
};

// 深色主题
export const darkTheme: ThemeConfig = {
  token: {
    colorPrimary: '#177ddc',
    colorSuccess: '#49aa19',
    colorWarning: '#d89614',
    colorError: '#d32029',
    colorInfo: '#177ddc',
    colorTextBase: '#e8e8e8',
    colorBgBase: '#141414',
    borderRadius: 6,
    fontSize: 14,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  components: {
    Layout: {
      headerBg: '#1f1f1f',
      headerHeight: 64,
      siderBg: '#000000',
      bodyBg: '#141414',
    },
    Menu: {
      darkItemBg: '#000000',
      darkItemSelectedBg: '#177ddc',
      darkItemHoverBg: '#1f1f1f',
    },
    Card: {
      borderRadiusLG: 8,
      boxShadowTertiary: '0 2px 8px rgba(0, 0, 0, 0.45)',
    },
    Button: {
      borderRadius: 6,
      controlHeight: 40,
      controlHeightLG: 48,
    },
    Input: {
      borderRadius: 6,
      controlHeight: 40,
      controlHeightLG: 48,
    },
    Table: {
      headerBg: '#1f1f1f',
      headerColor: '#e8e8e8',
      rowHoverBg: '#1f1f1f',
    },
  },
};
