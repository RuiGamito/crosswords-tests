const { By, Key, Builder } = require('selenium-webdriver')
require('chromedriver')
const fs = require('fs')

/**
 * Initialize the game by opening the game page, handling privacy consent,
 * and preparing the game iframe for interaction.
 *
 * @param {WebDriver} driver - The Selenium WebDriver instance.
 * @param {boolean} debug - Enable debug mode to log messages.
 * @returns {boolean} Returns true if initialization is successful, false otherwise.
 */
async function gameInit (driver, debug) {
  try {
    // Set implict timeout for 10 seconds
    await driver.manage().setTimeouts({ implicit: 10000 })

    log('[Game Init] Opening game page', debug)
    await driver.get('https://www.gamelab.com/games/daily-quick-crossword')

    // Agree with the privacy consent (not text dependent)
    const privacyConsent = await driver.findElement(By.xpath('//button[@mode="primary"]'))
    log("[Game Init] Privacy consent 'AGREE' button found.", debug)

    await privacyConsent.click()
    log("[Game Init] Clicked privacy consent 'AGREE' button.", debug)
    await wait(1)

    // Click the 'Play' button (which will prompt an ad)
    // In a CI environment, we'd want to have a way of bypassing the ad.
    const playButton = await driver.findElement(By.xpath('//button/div[contains(text(), "Play")]'))
    await playButton.click()
    log("[Game Init] Clicked 'Play' button", debug)
    await wait(1)

    // Waiting out the ad (consistently ~35s, so we wait 40s)
    log('[Game Init] Waiting for ad to finish...', debug)
    await wait(40)
    log('[Game Init] Ad should have finished.', debug)

    // Wait for game iframe
    const gameIframe = await driver.findElement(By.xpath('//iframe[@id="game-canvas"]'))
    log('[Game Init] Found game iFrame', debug)
    await driver.switchTo().frame('game-canvas')
    log('[Game Init] Switched to game-canvas iFrame', debug)
  } catch (error) {
    if (debug) console.error(error)
    return false
  }
  return true
}

/**
 * Activate a specific day's puzzle in the game.
 *
 * @param {WebDriver} driver - The Selenium WebDriver instance.
 * @param {string} day - The day to activate (e.g., "17").
 * @param {boolean} debug - Enable debug mode to log messages.
 * @returns {boolean} Returns true if day activation is successful, false otherwise.
 */
async function activateDay (driver, day, debug) {
  try {
    // Since the span element is not clickable we go right to its parent.
    const daySelector = await driver.findElement(By.xpath(`//span[text()="${day}"]/parent::*`))
    log(`[Day Activation] Desired day (${day}) selector found.`, debug)

    await daySelector.click()
    log(`[Day Activation] Clicked day (${day}) selector.`, debug)
    await wait(2)
  } catch (error) {
    if (debug) console.error(error)
    return false
  }
  return true
}

/**
 * Get the day for the currently activated puzzle in the game.
 *
 * @param {WebDriver} driver - The Selenium WebDriver instance.
 * @param {boolean} debug - Enable debug mode to log messages.
 * @returns {string|boolean} Returns the day as a string if successful, false otherwise.
 */
async function getDayForCurrentPuzzle (driver, debug) {
  try {
    // Open menu (although we don't actually need to, since all the DOM elements are avaliable).
    const menuButton = await driver.findElement(By.xpath('//button[@data-tip="(Ctrl+M)"]'))
    log('[Get puzzle day] Menu button found', debug)

    await menuButton.click()
    log('[Get puzzle day] Menu button clicked', debug)
    await wait(1)

    // We check the puzzle info in order to confirm the puzzle day
    const puzzleInfoButton = await driver.findElement(
      By.xpath('//button[contains(text(), "Puzzle info")]')
    )
    log('[Get puzzle day] Found puzzle info button.', debug)

    await puzzleInfoButton.click()
    log('[Get puzzle day] Clicked puzzle info button.', debug)
    await wait(1)

    const dateHeader = await driver.findElement(
      By.xpath('//h3[contains(text(), "Daily Quick Crossword")]')
    )
    const date = (await dateHeader.getText()).split(' ').slice(-3)
    log(`[Get puzzle day] Found date header. Spliced values: ${date}`, debug)

    // There's no easy way to close the 'puzzle info' dialog (no
    // id, static class, etc). We thus filter for available buttons
    // and statically select the 5th element.
    // In a real world scenario, we'd request the game team to add
    // a proper id to the dialog close button (at least in a debug build).
    const closeButtons = await driver.findElements(By.xpath('//section/button'))
    log(`[Get puzzle day] Found ${closeButtons.length} close buttons.`, debug)
    await closeButtons[5].click()
    log('[Get puzzle day] Clicked puzzle info close button (supposedly).', debug)
    await wait(1)

    return date[0]
  } catch (error) {
    if (debug) console.error(error)
    return false
  }
}

/**
 * Get the percentage completed without help in the current puzzle.
 * Assumes (and fails if not true) the puzzle completed screen is visible.
 *
 * @param {WebDriver} driver - The Selenium WebDriver instance.
 * @param {boolean} debug - Enable debug mode to log messages.
 * @returns {string|boolean} Returns the completion percentage as a string if successful, false otherwise.
 */
async function getPercentageCompletedWithoutHelp (driver, debug) {
  try {
    const percentageNoHelp = await (
      await driver.findElement(
        By.xpath(
          '//section/h4[contains(text(), "Completed without help or errors")]/following-sibling::*[1]'
        )
      )
    ).getText()
    log(`[Get % without help] Found completed with ${percentageNoHelp} help.`, debug)

    return percentageNoHelp
  } catch (error) {
    if (debug) console.error(error)
    return false
  }
}

/**
 * Capture a screenshot of the current game state and save it to a file.
 *
 * @param {WebDriver} driver - The Selenium WebDriver instance.
 * @param {string} filename - The name of the file to save the screenshot as (without extension).
 * @param {boolean} debug - Enable debug mode to log messages.
 * @returns {boolean} Returns true if the screenshot is successfully captured and saved, false otherwise.
 */
async function takeScreenshot (driver, filename, debug) {
  try {
    const screenshot = await driver.takeScreenshot()
    fs.writeFileSync(`${filename}.png`, screenshot, 'base64')
    log(`[Take Screenshot] Saved screenshot as ${filename}.png`, debug)
    return true
  } catch (error) {
    if (debug) console.error(error)
    return false
  }
}

/**
 * Solve the current puzzle using a predefined solution.
 *
 * @param {WebDriver} driver - The Selenium WebDriver instance.
 * @param {boolean} debug - Enable debug mode to log messages.
 * @returns {boolean} Returns true if solving is successful, false otherwise.
 */
async function solveFromSolution (driver, debug) {
  try {
    const solution = await readPuzzleSolution()
    log('[Solve from solution] Read puzzle solution from file.', debug)

    for (const word of solution) {
      await driver.actions().sendKeys(word).perform()
      await wait(0.2)
      await driver.actions().keyDown(Key.ENTER).keyUp(Key.ENTER).perform()
      await wait(0.2)
    }
    log('[Solve from solution] Finished applying solution to puzzle.', debug)
    await wait(2)
    return true
  } catch (error) {
    if (debug) console.error(error)
    return false
  }
}

/**
 * Solve the current puzzle by fully revealing the solution.
 *
 * @param {WebDriver} driver - The Selenium WebDriver instance.
 * @param {boolean} debug - Enable debug mode to log messages.
 * @returns {boolean} Returns true if solving is successful, false otherwise.
 */
async function solveFullReveal (driver, debug) {
  try {
    driver.actions().keyDown(Key.CONTROL).sendKeys('v').keyUp(Key.CONTROL).perform()
    log('[Solve full reveal] Opened reveal menu - with key strokes.', debug)

    await wait(1)

    const revealPuzzleButton = await driver.findElement(
      By.xpath('//ul/li[contains(text(), "Reveal puzzle")]')
    )
    log('[Solve full reveal] Found "Reveal puzzle" button.', debug)
    await revealPuzzleButton.click()
    log('[Solve full reveal] Clicked "Reveal puzzle" button.', debug)
    await wait(1)

    return true
  } catch (error) {
    if (debug) console.error(error)
    return false
  }
}

async function submitTotalScore (driver, debug) {
  try {
    const submitTotalScoreButton = await driver.findElement(
      By.xpath('//section/button[contains(text(), "Submit Total Score")]')
    )
    log('[Submit total Score] Found "Submit Total Score" button.', debug)

    await submitTotalScoreButton.click()
    log('[Submit total Score] Clicked "Submit Total Score" button.', debug)

    return true
  } catch (error) {
    if (debug) console.error(error)
    return false
  }
}

// Utils

/**
 * Utility function to read the puzzle solution from a file.
 *
 * @param {boolean} debug - Enable debug mode to log messages.
 * @returns {string[]} Returns an array of words representing the puzzle solution.
 * @throws {Error} Throws an error if there's a problem reading the solution file.
 */
async function readPuzzleSolution (debug) {
  try {
    const data = fs.readFileSync('solution.txt', 'utf8').split('\n')
    return data
  } catch (err) {
    console.error(err)
    throw err // You can choose to handle the error here or propagate it
  }
}

/**
 * Utility function to wait for a specified number of seconds.
 *
 * @param {number} seconds - The number of seconds to wait.
 * @returns {Promise<void>} Resolves after the specified wait time.
 */
async function wait (seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

/**
 * Utility function to log messages if debug mode is enabled.
 *
 * @param {string} message - The message to log.
 * @param {boolean} debug - Enable debug mode to log messages.
 */
function log (message, debug) {
  if (debug) console.log(message)
}

module.exports = {
  gameInit,
  activateDay,
  getDayForCurrentPuzzle,
  solveFullReveal,
  solveFromSolution,
  getPercentageCompletedWithoutHelp,
  submitTotalScore,
  takeScreenshot
}
