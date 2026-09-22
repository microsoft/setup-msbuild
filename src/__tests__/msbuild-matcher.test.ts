import * as fs from 'fs'
import * as path from 'path'

interface ProblemMatcherPattern {
  regexp: string
  file?: number
  line?: number
  column?: number
  severity?: number
  code?: number
  message?: number
  fromPath?: number
}

interface ProblemMatcherOwner {
  owner: string
  pattern: ProblemMatcherPattern[]
}

interface ProblemMatcherFile {
  problemMatcher: ProblemMatcherOwner[]
}

const matcherPath = path.join(__dirname, '..', '..', '.github', 'msbuild.json')
const matcherFile: ProblemMatcherFile = JSON.parse(
  fs.readFileSync(matcherPath, 'utf8')
)

function findOwner(owner: string): ProblemMatcherOwner {
  const found = matcherFile.problemMatcher.find(m => m.owner === owner)
  if (!found) {
    throw new Error(`No matcher owner named ${owner} found`)
  }
  return found
}

describe('msbuild problem matcher', () => {
  it('is valid JSON with the expected owners', () => {
    expect(matcherFile.problemMatcher.map(m => m.owner)).toEqual([
      'msbuild',
      'msbuild-no-location'
    ])
  })

  describe('msbuild owner (file-based diagnostics)', () => {
    const regexp = new RegExp(findOwner('msbuild').pattern[0].regexp)

    it('matches a csc-style error with file, line, column and project path', () => {
      const line =
        'Program.cs(10,5): error CS1002: ; expected [C:\\proj\\proj.csproj]'
      const match = regexp.exec(line)
      expect(match).not.toBeNull()
      expect(match?.[1]).toBe('Program.cs')
      expect(match?.[2]).toBe('10')
      expect(match?.[3]).toBe('5')
      expect(match?.[4]).toBe('error')
      expect(match?.[5]).toBe('CS1002')
      expect(match?.[6]).toBe('; expected')
      expect(match?.[7]).toBe('C:\\proj\\proj.csproj')
    })

    it('matches an MSB-coded warning with file and line only', () => {
      const line =
        'C:\\proj\\proj.csproj(15,1): warning MSB3277: Found conflicts [C:\\proj\\proj.csproj]'
      const match = regexp.exec(line)
      expect(match).not.toBeNull()
      expect(match?.[4]).toBe('warning')
      expect(match?.[5]).toBe('MSB3277')
    })

    it('matches a diagnostic without a trailing project path', () => {
      const line = 'Program.cs(3,1): error CS0246: The type or namespace name could not be found'
      const match = regexp.exec(line)
      expect(match).not.toBeNull()
      expect(match?.[5]).toBe('CS0246')
      expect(match?.[6]).toBe(
        'The type or namespace name could not be found'
      )
      expect(match?.[7]).toBeUndefined()
    })
  })

  describe('msbuild-no-location owner (engine-level diagnostics)', () => {
    const regexp = new RegExp(findOwner('msbuild-no-location').pattern[0].regexp)

    it('matches an MSBuild engine error with no file/line info', () => {
      const line = 'MSBUILD : error MSB1009: Project file does not exist.'
      const match = regexp.exec(line)
      expect(match).not.toBeNull()
      expect(match?.[1]).toBe('error')
      expect(match?.[2]).toBe('MSB1009')
      expect(match?.[3]).toBe('Project file does not exist.')
    })

    it('does not match lines already covered by the file-based owner', () => {
      const line =
        'Program.cs(10,5): error CS1002: ; expected [C:\\proj\\proj.csproj]'
      expect(regexp.test(line)).toBe(false)
    })
  })
})
