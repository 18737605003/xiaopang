import React from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  extra?: React.ReactNode;
}

const PageHeader: React.FC<PageHeaderProps> = ({ title, description, extra }) => {
  return (
    <div className="page-header">
      <div className="page-header-row">
        <div>
          <h2 className="page-header-title">{title}</h2>
          {description && <p className="page-header-desc">{description}</p>}
        </div>
        {extra && <div style={{ flexShrink: 0 }}>{extra}</div>}
      </div>
    </div>
  );
};

export default PageHeader;
