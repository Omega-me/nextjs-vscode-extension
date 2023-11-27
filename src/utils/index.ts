export interface IData {
  page?: string;
  pageOriginalName?: string;
  pageFolder?: string;
  pagePath?: string;
  pageName?: string;
  hasModule?: boolean;
  componentName?: string;
  moduleName?: string;
  moduleFile?: string;
  hasParams?: boolean;
  hasMultipleParams: boolean;
}

export interface IConfig {
  pagesPath?: string;
  modulesPath?: string;
  componentsPath?: string;
}

export const capitalize = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1);
};

export const getPageName = (str: string) => {
  const arr = str.split('/');
  return arr[arr.length - 1];
};

export const checkIfEmptyString = (str?: string) => {
  if (str === undefined) {
    return true;
  }
  if (str.trim() === '') {
    return true;
  }
  return false;
};

export const checkValidConfigPath = (config: IConfig) => {
  if (
    (!config.pagesPath?.startsWith('/src') && config.pagesPath?.trim() !== '') ||
    (!config.modulesPath?.startsWith('/src') && config.modulesPath?.trim() !== '') ||
    (!config.componentsPath?.startsWith('/src') && config.componentsPath?.trim() !== '')
  ) {
    return false;
  }
  return true;
};

export const generatePage = (data: IData, config: IConfig) => {
  let pageContent = '';
  if (data.hasModule) {
    pageContent = `import { PageProps, prefetchQuery } from './${data.pageName}.utils';
import { ${data.moduleName} } from ${!checkIfEmptyString(config.modulesPath) ? "'" + config.modulesPath?.replace('/src', '@') + "'" : "'@/containers/modules'"};
import { HydrationBoundary, dehydrate } from '@tanstack/react-query';

const ${data.pageName} = async (props: PageProps) => {
  const queryClient = await prefetchQuery(props);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <${data.moduleName} />
    </HydrationBoundary>
  );
};

export default ${data.pageName};`;
  } else {
    pageContent = `
import { PageProps } from './utils';

const ${data.pageName} = async (props: PageProps) => {
  return <div>${data.pageName}</div>;
};

export default ${data.pageName};`;
  }

  return pageContent;
};

export const generateUtil = (data: IData) => {
  let utilContent = '';
  const paramsType = data.hasParams ? (data.hasMultipleParams ? `params: { ${data.page}: string[] };` : `params: { ${data.page}: string };`) : '';

  if (data.hasModule) {
    utilContent = `import { IPageProps } from '@/common/interfaces';
import { QueryClient } from '@tanstack/react-query';

export interface PageProps extends IPageProps {
  ${paramsType}
}

export const prefetchQuery = async (props: PageProps): Promise<QueryClient> => {
  const queryClient = new QueryClient();
    
  return queryClient;
};`;
  } else {
    utilContent = `
import { IPageProps } from '@/common/interfaces';
  
export interface PageProps extends IPageProps {
  ${paramsType}
}`;
  }

  return utilContent;
};

export const generateModule = (
  data: IData | { module?: string; moduleName?: string; moduleFile?: string; hasComponent?: boolean; componentName?: string },
  config: IConfig,
) => {
  return `'use client';
import { ${data.componentName} } from ${
    !checkIfEmptyString(config.componentsPath) ? "'" + config.componentsPath?.replace('/src', '@') + "'" : "'@/containers/components'"
  };

const ${data.moduleName} = () => {
  return <${data.componentName} />;
};

export default ${data.moduleName};`;
};

export const generateModuleWithoutComponent = (
  data: IData | { module?: string; moduleName?: string; moduleFile?: string; hasComponent?: boolean; componentName?: string },
) => {
  return `'use client';

const ${data.moduleName} = () => {
  return <div>${data.moduleName}</div>;
};

export default ${data.moduleName};`;
};

export const generateComponent = (
  data: IData | { module?: string; moduleName?: string; moduleFile?: string; hasComponent?: boolean; componentName?: string },
) => {
  return `'use client';
import s from './${data.componentName?.toLowerCase()}.module.scss';

interface ${data.componentName}Props {}

const ${data.componentName}: React.FC<${data.componentName}Props> = props => {
  return <div className={s.${data.componentName?.toLowerCase()}}>${data.componentName}</div>;
};

export default ${data.componentName};`;
};

export const generateCssFile = (
  data: IData | { module?: string; moduleName?: string; moduleFile?: string; hasComponent?: boolean; componentName?: string },
) => {
  return `// .${data.componentName?.toLowerCase()} {
// }`;
};
