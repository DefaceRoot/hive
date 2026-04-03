import { beforeEach, describe, expect, test, vi } from 'vitest'
import { useFileTreeStore } from '../../src/renderer/src/stores/useFileTreeStore'

describe('useFileTreeStore', () => {
  const worktreePath = '/repo'
  const nestedDirPath = '/repo/src/components'

  beforeEach(() => {
    localStorage.clear()
    useFileTreeStore.setState({
      fileTreeByWorktree: new Map(),
      isLoading: false,
      error: null,
      fileIndexByWorktree: new Map(),
      fileIndexLoadingByWorktree: new Map(),
      expandedPathsByWorktree: new Map(),
      filterByWorktree: new Map()
    })

    const loadChildren = vi.fn().mockImplementation((dirPath: string) => {
      if (dirPath === '/repo/src') {
        return Promise.resolve({
          success: true,
          children: [
            {
              name: 'components',
              path: nestedDirPath,
              relativePath: 'src/components',
              isDirectory: true,
              extension: null,
              children: undefined
            }
          ]
        })
      }

      return Promise.resolve({
        success: true,
        children: [
          {
            name: 'FileTree.tsx',
            path: '/repo/src/components/FileTree.tsx',
            relativePath: 'src/components/FileTree.tsx',
            isDirectory: false,
            extension: '.tsx'
          }
        ]
      })
    })

    window.fileTreeOps = {
      scan: vi.fn().mockResolvedValue({
        success: true,
        tree: [
          {
            name: 'src',
            path: '/repo/src',
            relativePath: 'src',
            isDirectory: true,
            extension: null,
            children: [
              {
                name: 'components',
                path: nestedDirPath,
                relativePath: 'src/components',
                isDirectory: true,
                extension: null,
                children: undefined
              }
            ]
          }
        ]
      }),
      loadChildren,
      watch: vi.fn(),
      unwatch: vi.fn(),
      onChange: vi.fn().mockReturnValue(() => {}),
      scanFlat: vi.fn()
    }
  })

  test('re-hydrates expanded nested directories after a tree refresh', async () => {
    useFileTreeStore.getState().setExpanded(worktreePath, new Set(['/repo/src', nestedDirPath]))

    await useFileTreeStore.getState().loadFileTree(worktreePath)

    const tree = useFileTreeStore.getState().getFileTree(worktreePath)
    const src = tree[0]
    const components = src?.children?.[0]

    expect(window.fileTreeOps.loadChildren).toHaveBeenCalledWith('/repo/src', worktreePath)
    expect(window.fileTreeOps.loadChildren).toHaveBeenCalledWith(nestedDirPath, worktreePath)
    expect(components?.children).toEqual([
      expect.objectContaining({
        name: 'FileTree.tsx',
        relativePath: 'src/components/FileTree.tsx'
      })
    ])
  })
})
