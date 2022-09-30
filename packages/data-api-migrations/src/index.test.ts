/* eslint-disable @typescript-eslint/no-explicit-any */
import DataAPIMigrations from '.'
import * as AuroraDataAPI from '@caspiandb/aurora-data-api'
import { tsTemplate, jsTemplate } from './templates'
import { format as formatDate } from 'date-fns'
import { writeFile, readdir, move } from 'fs-extra'

const now = Date.now()
Date.now = jest.fn(() => now)

beforeAll(() => {
  jest.useFakeTimers('modern');
  jest.setSystemTime(now);
});

afterAll(() => {
  jest.useRealTimers();
});

jest.mock('fs-extra', () => {
  const origFs = jest.requireActual('fs-extra');
  const mockedFs = Object.keys(origFs).reduce((pre, methodName) => {
    pre[methodName] = jest.fn();
    return pre;
  }, {});
  return {
    __esModule: true,
    ...mockedFs,
    readdir: jest.fn(() =>
      Promise.resolve([
        `${formatDate(now, 'yyyyMMddHHmmss')}_foobar.ts`,
        `${formatDate(Date.now(), 'yyyyMMddHHmmss')}_barbaz.ts`,
      ]))
  }
})
jest.mock('@caspiandb/aurora-data-api')

const tsCompilerMocks = {
  compile: jest.fn().mockResolvedValue([
    `${__dirname}/__fixtures__/20200107142955_createUsers.js`,
    `${__dirname}/__fixtures__/20200116113329_createProjects.js`,
  ]),
  cleanup: jest.fn().mockResolvedValue(undefined)
}

jest.mock('./TypeScriptCompiler', () => {
  return {
    TypeScriptCompiler: jest.fn().mockImplementation(() => tsCompilerMocks)
  }
})

let manager: DataAPIMigrations
let auroraDataAPIMock: jest.Mocked<AuroraDataAPI>

const createManager = (options?: any): DataAPIMigrations => {
  manager = new DataAPIMigrations({
    dataAPI: {
      secretArn: 'example',
      resourceArn: 'example'
    },
    ...options
  })
  auroraDataAPIMock = manager.dataAPI as jest.Mocked<AuroraDataAPI>
  return manager
}

describe('DataAPIMigrations#generateMigration', () => {
  it('writes the ts file and returns the filename', async () => {
    createManager()
    const resultPath = await manager.generateMigration('foobar')
    const expectedPath = `${process.cwd()}/migrations/${formatDate(now, 'yyyyMMddHHmmss')}_foobar.ts`
    expect(writeFile).toHaveBeenCalledWith(expectedPath, tsTemplate())
    expect(resultPath).toEqual(expectedPath)
  })

  it('writes the js file and returns the filename', async () => {
    createManager({ typescript: false })
    const resultPath = await manager.generateMigration('foobar')
    const expectedPath = `${process.cwd()}/migrations/${formatDate(now, 'yyyyMMddHHmmss')}_foobar.js`
    expect(writeFile).toHaveBeenCalledWith(expectedPath, jsTemplate())
    expect(resultPath).toEqual(expectedPath)
  })
})

describe('DataAPIMigrations#bumpMigration', () => {
  it('bump existing migration', async () => {
    createManager()
    await manager.generateMigration('foobar')
    const resultPath = await manager.bumpMigration('foobar')
    const expectedPath = `${process.cwd()}/migrations/${formatDate(now, 'yyyyMMddHHmmss')}_foobar.ts`
    expect(writeFile).toHaveBeenCalledWith(expectedPath, tsTemplate())
    expect(readdir).toHaveBeenCalledWith(`${process.cwd()}/migrations`)
    expect(move).toHaveBeenCalledWith(expectedPath, expectedPath)
    expect(resultPath).toEqual(expectedPath)
  })
})

describe('DataAPIMigrations#getAppliedMigrationIds', () => {
  beforeEach(() => {
    createManager()
    auroraDataAPIMock.query = jest.fn().mockResolvedValue({ rows: [{ id: '20200107142955' }, { id: '20200116113329' }] })
  })

  it('ensures the migration table exists', async () => {
    await manager.getAppliedMigrationIds()
    expect(auroraDataAPIMock.query).toHaveBeenCalledWith(
      'CREATE TABLE IF NOT EXISTS __migrations__ (id varchar NOT NULL UNIQUE)',
      undefined,
      { includeResultMetadata: false }
    )
  })

  it('makes an SQL query to fetch the list of applied migrations', async () => {
    await manager.getAppliedMigrationIds()
    expect(auroraDataAPIMock.query).toHaveBeenCalledWith('SELECT id FROM __migrations__')
  })

  it('returns a list of applied migration ids', async () => {
    const result = await manager.getAppliedMigrationIds()
    expect(result).toMatchObject(['20200107142955', '20200116113329'])
  })
})

describe('DataAPIMigrations#applyMigrations', () => {
  beforeEach(() => {
    createManager()
    auroraDataAPIMock.query = jest.fn().mockResolvedValue({ rows: [] })
    Object.values(tsCompilerMocks).forEach((mock) => mock.mockClear())
  })

  it('calls compile on the compiler', async () => {
    await manager.applyMigrations()
    expect(tsCompilerMocks.compile).toHaveBeenCalled()
  })

  it('applies each migration', async () => {
    await manager.applyMigrations()
    expect(auroraDataAPIMock.query).toHaveBeenCalledWith('CREATE TABLE users (id int, email varchar)')
    expect(auroraDataAPIMock.query).toHaveBeenCalledWith('CREATE TABLE projects (id int, name)')
  })

  it('calls clean up on the compiler', async () => {
    await manager.applyMigrations()
    expect(tsCompilerMocks.cleanup).toHaveBeenCalled()
  })
})

describe('DataAPIMigrations#rollback', () => {
  beforeEach(() => {
    createManager()
    auroraDataAPIMock.query = jest.fn().mockResolvedValue({ rows: [{ id: '20200107142955' }, { id: '20200116113329' }] })
    Object.values(tsCompilerMocks).forEach((mock) => mock.mockClear())
  })

  it('calls compile on the compiler', async () => {
    await manager.rollbackMigrations()
    expect(tsCompilerMocks.compile).toHaveBeenCalled()
  })

  it('rollsback the last applied migration', async () => {
    await manager.rollbackMigrations()
    expect(auroraDataAPIMock.query).toHaveBeenCalledWith('DROP TABLE projects')
  })

  it('calls clean up on the compiler', async () => {
    await manager.rollbackMigrations()
    expect(tsCompilerMocks.cleanup).toHaveBeenCalled()
  })
})
