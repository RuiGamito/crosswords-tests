const {
  gameInit,
  activateDay,
  getDayForCurrentPuzzle,
  solveFullReveal,
  solveFromSolution,
  getPercentageCompletedWithoutHelp,
  submitTotalScore,
  takeScreenshot
} = require('./selenium_functions')
const { Builder } = require('selenium-webdriver')
const assert = require('assert')
const video = require('wdio-video-reporter')

let debug = false

const debugIndex = process.argv.indexOf('--debug')

if (debugIndex !== -1) {
  debug = true
  console.log(debug)
} else {
  console.log('Debug mode is disabled', debug)
}

// Define a test suite for revealing that solves today's puzzle by triggering
// the full puzzle reveal button.
describe('Complete daily puzzle with full reveal', function () {
  let driver

  // Before running tests, set up the WebDriver and initialize the game
  before(async function () {
    this.timeout(80000) // 80 seconds

    // Initialize the WebDriver before running tests
    driver = await new Builder().forBrowser('chrome').build()

    const gameInitResult = await gameInit(driver, debug)
    assert.equal(gameInitResult, true, 'Game init failed')
  })

  // Test to validate the page title
  it('Validate page title', async function () {
    this.timeout(10000) // 10 seconds

    const pageTitle = await driver.getTitle()
    assert.strictEqual(pageTitle, 'Best Daily Quick Crossword - Free Online Game | GameLab')
  })

  // Test to complete today's puzzle using the "reveal" function
  it("Complete today's puzzle (reveal)", async function () {
    this.timeout(60000) // 60 seconds

    // Activate today's puzzle
    const date = new Date()
    const today = date.getDate().toString()
    await activateDay(driver, today, debug)

    const activatedDay = await getDayForCurrentPuzzle(driver, debug)
    assert.equal(activatedDay, today, `Puzzle day should be '${today}'`)

    const fullyRevealed = await solveFullReveal(driver, debug)
    assert.equal(fullyRevealed, true, `Puzzle day should be '${today}'`)

    const percentage = await getPercentageCompletedWithoutHelp(driver, debug)
    assert.equal(percentage, '0%', 'Percentage completed without help should be 0%')

    await takeScreenshot(driver, 'complete_screen_puzzle_reveal')

    const totalScoreSubmitted = await submitTotalScore(driver, debug)
    assert.equal(totalScoreSubmitted, true, 'Total score could not be submitted')
  })

  // Clean up resources after all tests in this suite are done
  after(async function () {
    if (driver) {
      await driver.quit()
    }
  })
})

// Define a test suite for loading a preset solution for the 1st day
// of the month and conveying it to the puzzle, thus completing it.
// Requires that the solution file is updated on a monthly basis.
describe('Complete puzzle with "manual" inputs (day 1)', function () {
  let driver

  // Before running tests, set up the WebDriver and initialize the game
  before(async function () {
    this.timeout(80000) // 60 seconds

    // Initialize the WebDriver
    driver = await new Builder().forBrowser('chrome').build()
    await gameInit(driver, debug)
  })

  // Test to validate the page title
  it('Validate page title', async function () {
    this.timeout(60000) // 60 seconds

    const pageTitle = await driver.getTitle()
    assert.strictEqual(pageTitle, 'Best Daily Quick Crossword - Free Online Game | GameLab')
  })

  // Test to complete the puzzle manually
  it('Complete puzzle from day 1', async function () {
    this.timeout(60000) // 60 seconds

    // Activate the 1st of the month puzzle
    await activateDay(driver, '1')
    const activatedDay = await getDayForCurrentPuzzle(driver, debug)
    assert.equal(activatedDay, '1', 'Puzzle day should be "1"')

    const solved = await solveFromSolution(driver, debug)
    assert.equal(solved, true, 'Puzzle should have been fully filled')

    const percentage = await getPercentageCompletedWithoutHelp(driver, debug)
    assert.equal(percentage, '100%', 'Percentage completed without help should be 100%')

    await takeScreenshot(driver, 'complete_screen_puzzle_inputs', debug)
  })

  // Clean up resources after all tests in this suite are done
  after(async function () {
    if (driver) {
      await driver.quit()
    }
  })
})
