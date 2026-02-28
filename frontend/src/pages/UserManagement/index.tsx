import { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { usersApi, User } from '../../api/users';
import { useAuthStore } from '../../store/authStore';

const UserManagement = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [form] = Form.useForm();
  const { user: currentUser } = useAuthStore();
  
  const isAdmin = currentUser?.role === 'ADMIN';

  useEffect(() => {
    loadUsers();
  }, [pagination.current, pagination.pageSize]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await usersApi.getUsers({
        page: pagination.current,
        pageSize: pagination.pageSize,
      });
      setUsers(response.data);
      setPagination(prev => ({ ...prev, total: response.total }));
    } catch (error) {
      message.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 100, ellipsis: true },
    { title: '用户名', dataIndex: 'username', key: 'username' },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <Tag color={role === 'ADMIN' ? 'red' : 'blue'}>
          {role === 'ADMIN' ? '管理员' : '普通用户'}
        </Tag>
      ),
    },
    { title: '部门', dataIndex: 'department', key: 'department' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'ACTIVE' ? 'green' : 'default'}>
          {status === 'ACTIVE' ? '激活' : '未激活'}
        </Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: User) => (
        <Space>
          {isAdmin && (
            <>
              <Button
                type="link"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              >
                编辑
              </Button>
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
                onClick={() => handleDelete(record.id)}
              >
                删除
              </Button>
            </>
          )}
          {!isAdmin && <span style={{ color: '#999' }}>无权限</span>}
        </Space>
      ),
    },
  ];

  const handleEdit = (user: User) => {
    setEditingUser(user);
    // 编辑时不设置密码字段的值
    const { password, ...userWithoutPassword } = user as any;
    form.setFieldsValue(userWithoutPassword);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除该用户吗？',
      onOk: async () => {
        try {
          await usersApi.deleteUser(id);
          message.success('删除成功');
          loadUsers();
        } catch (error) {
          message.error('删除失败');
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      // 如果是编辑模式且密码为空，则从提交数据中移除密码字段
      const submitData = { ...values };
      if (editingUser && (!submitData.password || submitData.password.trim() === '')) {
        delete submitData.password;
      }
      
      if (editingUser) {
        await usersApi.updateUser(editingUser.id, submitData);
        message.success('更新成功');
      } else {
        await usersApi.createUser(submitData);
        message.success('创建成功');
      }
      setIsModalOpen(false);
      setEditingUser(null);
      form.resetFields();
      loadUsers();
    } catch (error: any) {
      message.error(error.response?.data?.message || '操作失败');
    }
  };

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        {isAdmin ? (
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setIsModalOpen(true)}
          >
            新增用户
          </Button>
        ) : (
          <div style={{ color: '#999' }}>
            仅管理员可添加用户
          </div>
        )}
      </div>

      <Table 
        columns={columns} 
        dataSource={users} 
        rowKey="id"
        loading={loading}
        pagination={{
          ...pagination,
          onChange: (page, pageSize) => {
            setPagination(prev => ({ ...prev, current: page, pageSize }));
          },
        }}
      />

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          setEditingUser(null);
          form.resetFields();
        }}
        onOk={() => form.submit()}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="用户名"
            name="username"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ required: true, type: 'email', message: '请输入有效邮箱' }]}
          >
            <Input />
          </Form.Item>
          {!editingUser ? (
            <Form.Item
              label="密码"
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          ) : (
            <Form.Item
              label="新密码"
              name="password"
              help="留空则不修改密码"
            >
              <Input.Password placeholder="留空则不修改密码" />
            </Form.Item>
          )}
          <Form.Item 
            label="角色" 
            name="role"
            initialValue="USER"
          >
            <Select
              options={[
                { label: '管理员', value: 'ADMIN' },
                { label: '普通用户', value: 'USER' },
              ]}
            />
          </Form.Item>
          <Form.Item label="部门" name="department">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UserManagement;
