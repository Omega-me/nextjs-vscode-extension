export interface IData {
  page?: string;
  pageOriginalName?: string;
  pageFolder?: string;
  pagePath?: string;
  pageName?: string;
  hasModule?: boolean;
  componentName?: string;
  moduleName?: string;
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

export const generatePage = (data: IData, config: IConfig) => {
  let pageContent = '';
  if (data.hasModule) {
    pageContent = `
      import { PageProps, prefetchQuery } from './utils';
      import { ${data.moduleName} } from '@/containers/modules';
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

      export default ${data.pageName};
    `;
  }

  return pageContent;
};

export const generateUtil = (data: IData) => {
  let utilContent = '';
  const paramsType = data.hasParams ? (data.hasMultipleParams ? `params: { ${data.page}: string[] };` : `params: { ${data.page}: string };`) : '';

  if (data.hasModule) {
    utilContent = `
      import { IPageProps } from '@/common/interfaces';
      import { QueryClient } from '@tanstack/react-query';

      export interface PageProps extends IPageProps {
        ${paramsType}
      }

      export const prefetchQuery = async (props: PageProps): Promise<QueryClient> => {
        const queryClient = new QueryClient();

        return queryClient;
      };
    `;
  } else {
    utilContent = `
        import { IPageProps } from '@/common/interfaces';
  
        export interface PageProps extends IPageProps {
          ${paramsType}
        }
      `;
  }

  return utilContent;
};

export const generateModule = (data: IData) => {
  return `
  'use client';
  import { ${data.componentName} } from '@/containers/components';

  const ${data.moduleName} = () => {
    return <${data.componentName} />;
  };

  export default ${data.moduleName};
  `;
};

export const generateComponent = (data: IData) => {
  return `
  'use client';

  interface ${data.componentName}Props {}

  const ${data.componentName}: React.FC<${data.componentName}Props> = props => {
    return <div>${data.componentName}</div>;
  };

  export default ${data.componentName};
  `;
};
