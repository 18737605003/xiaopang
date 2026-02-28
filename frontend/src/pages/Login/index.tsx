import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Modal } from 'antd';
import { UserOutlined, LockOutlined, CheckCircleOutlined, CloseCircleOutlined, RobotOutlined } from '@ant-design/icons';
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
      
      // 登录成功 - 显示成功弹框
      Modal.success({
        title: '登录成功',
        icon: <CheckCircleOutlined style={{ color: '#52c41a' }} />,
        content: (
          <div>
            <p>欢迎回来，<strong>{response.user.username}</strong>！</p>
            <p>角色：{response.user.role === 'ADMIN' ? '管理员' : '普通用户'}</p>
            <p>正在跳转到系统...</p>
          </div>
        ),
        okText: '进入系统',
        onOk: () => {
          login(response.user, response.token);
          navigate('/');
        },
      });
      
      // 3秒后自动跳转
      setTimeout(() => {
        login(response.user, response.token);
        navigate('/');
      }, 3000);
      
    } catch (error: any) {
      // 登录失败 - 显示错误弹框
      const errorMessage = error.response?.data?.message;
      const status = error.response?.status;
      
      let title = '登录失败';
      let content = '';
      
      if (errorMessage?.includes('用户名不存在')) {
        title = '用户名不存在';
        content = `用户名 "${values.username}" 不存在，请检查后重试。`;
      } else if (errorMessage?.includes('密码错误')) {
        title = '密码错误';
        content = '您输入的密码不正确，请重新输入。';
      } else if (status === 403) {
        title = '账户已被禁用';
        content = '您的账户已被管理员禁用，请联系管理员解决。';
      } else if (status === 401) {
        title = '认证失败';
        content = '用户名或密码错误，请检查后重试。';
      } else {
        title = '登录失败';
        content = errorMessage || '服务器错误，请稍后重试。';
      }
      
      Modal.error({
        title,
        icon: <CloseCircleOutlined style={{ color: '#ff4d4f' }} />,
        content: (
          <div>
            <p>{content}</p>
            {errorMessage?.includes('密码') && (
              <p style={{ marginTop: 10, color: '#999', fontSize: 12 }}>
                提示：如果忘记密码，请联系管理员重置。
              </p>
            )}
          </div>
        ),
        okText: '重新登录',
      });
      
      // 同时显示简短的消息提示
      message.error(title);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card 
        className="login-card" 
        title={
          <div style={{ textAlign: 'center' }}>
            <div className="login-icon-wrapper">
              <RobotOutlined style={{ fontSize: 32, color: 'white' }} />
            </div>
            <div style={{ marginTop: 50, fontWeight: 700, fontSize: 26 }}>
              AI Workbench
            </div>
          </div>
        }
      >
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

          <Form.Item style={{ marginBottom: 0, marginTop: 32 }}>
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
          
          <div className="login-tips">
            <p>👤 默认管理员账号：admin / admin123</p>
            <p>🔒 首次登录后请立即修改密码</p>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default Login;
