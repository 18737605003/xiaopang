import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, message } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../store/authStore';
import { authApi } from '../../api/auth';
import './index.css';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    
    try {
      const response = await authApi.login(values);
      login(response.user, response.token);
      message.success(`欢迎回来，${response.user.username}`);
      navigate('/');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message;
      const status = error.response?.status;
      
      if (errorMessage?.includes('用户名不存在')) {
        message.error('用户名不存在，请检查后重试');
      } else if (errorMessage?.includes('密码错误')) {
        message.error('密码错误，请重新输入');
      } else if (status === 403) {
        message.error('账户已被禁用，请联系管理员');
      } else if (status === 401) {
        message.error('用户名或密码错误');
      } else {
        message.error(errorMessage || '服务器错误，请稍后重试');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <div className="login-logo-icon">AI</div>
            <h1 className="login-title">AI Enterprise</h1>
            <p className="login-subtitle">企业智能工作平台</p>
          </div>
        </div>

        <div className="login-body">
          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input 
                prefix={<UserOutlined />} 
                placeholder="用户名" 
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password 
                prefix={<LockOutlined />} 
                placeholder="密码" 
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, marginTop: 28 }}>
              <Button 
                type="primary" 
                htmlType="submit" 
                loading={loading} 
                block
                size="large"
              >
                {loading ? '登录中...' : '登 录'}
              </Button>
            </Form.Item>
          </Form>

          <div className="login-tips">
            <SafetyOutlined style={{ marginRight: 6 }} />
            <span>默认账号 admin / admin123 &middot; 首次登录请修改密码</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
