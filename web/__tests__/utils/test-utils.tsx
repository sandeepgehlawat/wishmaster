import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Create a fresh QueryClient for each test
function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

interface WrapperProps {
  children: React.ReactNode;
}

// Custom render function that includes providers
function customRender(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: WrapperProps) {
    return (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    );
  }

  return {
    ...render(ui, { wrapper: Wrapper, ...options }),
    queryClient,
  };
}

// Re-export everything from testing-library
export * from '@testing-library/react';
export { userEvent } from '@testing-library/user-event';

// Override the render method
export { customRender as render };

// Utility to wait for async operations
export async function waitForLoadingToFinish() {
  const { waitFor } = await import('@testing-library/react');
  await waitFor(
    () => {
      const loaders = document.querySelectorAll('[data-testid="loading"]');
      if (loaders.length > 0) {
        throw new Error('Still loading');
      }
    },
    { timeout: 5000 }
  );
}

// Utility to create mock auth context
export function createMockAuthContext(overrides = {}) {
  return {
    user: null,
    token: null,
    isLoading: false,
    isAuthenticated: false,
    login: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  };
}

// Utility to create mock router
export function createMockRouter(overrides = {}) {
  return {
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn().mockResolvedValue(undefined),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    ...overrides,
  };
}
