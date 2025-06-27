// ============================================================================
// Part 1: Variables and Element Selectors
// ============================================================================

// Selectors for the main word form and list
const wordForm = document.getElementById('wordForm');
const wordInput = document.getElementById('word');
const definitionInput = document.getElementById('definition');
const exampleInput = document.getElementById('example');
const addUpdateBtn = document.getElementById('addUpdateBtn'); // Button for adding/updating
const vocabularyList = document.getElementById('vocabularyList');
const addWordAudioBtn = document.getElementById('addWordAudioBtn'); // New: Audio button for add word input

// Selectors for navigation buttons
const showAddWordSectionBtn = document.getElementById('showAddWordSection');
const showVocabularyListSectionBtn = document.getElementById('showVocabularyListSection');
const showExerciseSectionBtn = document.getElementById('showExerciseSection');
const showSentenceCorrectorSectionBtn = document.getElementById('showSentenceCorrectorSection');

// Selectors for different sections
const addWordSection = document.getElementById('addWordSection');
const vocabularyListSection = document.getElementById('vocabularyListSection');
const exerciseSection = document.getElementById('exerciseSection');
const sentenceCorrectorSection = document.getElementById('sentenceCorrectorSection');

// Selectors for the flashcard exercise
const startExerciseBtn = document.getElementById('startExercise');
const flashcardContainer = document.getElementById('flashcardContainer');
const flashcard = document.getElementById('flashcard');
const flashcardFront = document.getElementById('flashcardFront');
const flashcardBack = document.getElementById('flashcardBack');
const nextCardBtn = document.getElementById('nextCard');
const noWordsMessage = document.getElementById('noWordsMessage');

// Selectors for flashcard feedback buttons
const feedbackButtonsContainer = document.querySelector('.feedback-buttons');
const correctBtn = document.getElementById('correctBtn');
const incorrectBtn = document.getElementById('incorrectBtn');

// Selectors for the sentence corrector
const sentenceInput = document.getElementById('sentenceInput');
const checkSentenceBtn = document.getElementById('checkSentenceBtn');
const correctionOutput = document.getElementById('correctionOutput');
const wordToUseDisplay = document.getElementById('wordToUseDisplay');
const getNewWordBtn = document.getElementById('getNewWordBtn');

// State variables for editing words
let isEditing = false;
let editingIndex = -1; // Stores the index of the word being edited

// Global variable for the current word in the sentence corrector
let currentRequiredWord = null;

// Spaced Repetition Intervals (in days) - Simple example
// 0 means review immediately (for new/incorrect words), then 1 day, 3 days, etc.
const SR_INTERVALS = [0, 1, 3, 7, 15, 30, 60, 120];

// ============================================================================
// Part 2: Data Storage (localStorage)
// ============================================================================

// Load vocabulary from localStorage, or initialize as an empty array
let vocabulary = JSON.parse(localStorage.getItem('vocabulary')) || [];

// Save vocabulary to localStorage
function saveVocabulary() {
    localStorage.setItem('vocabulary', JSON.stringify(vocabulary));
}

// ============================================================================
// Part 3: Functions to Add, Edit, and Display Words
// ============================================================================

// Handles adding a new word or updating an existing one
async function handleAddUpdateWord(event) {
    event.preventDefault(); // Prevent default form submission

    const word = wordInput.value.trim();
    let definition = definitionInput.value.trim();
    let example = exampleInput.value.trim();

    // CRITICAL FIX: Before saving, if definition/example are still placeholders
    // or empty, try to fetch again and AWAIT the result.
    const isDefinitionEmptyOrPlaceholder = !definition || definition === 'Definition not found.' || definition === 'Error fetching definition.' || definition === 'Fetching definition...';
    const isExampleEmptyOrPlaceholder = !example || example === `(Example for "${word}" not provided. Add manually.)` || example === '(No example found for this definition.)' || example === '(No example found for this word.)' || example === '(Error fetching example.)' || example === 'Fetching examples...';

    if (isDefinitionEmptyOrPlaceholder || isExampleEmptyOrPlaceholder) {
        console.log("Word Form Debug: Definition/Example missing or placeholder on submit, attempting final fetch...");
        await fetchWordDetails(word); // AWAIT this call to ensure it completes
        // IMPORTANT: Re-read the values from the input fields AFTER the await
        definition = definitionInput.value.trim();
        example = exampleInput.value.trim();
    }

    // Check for duplicate word (only if not editing, or if word changed and is now a duplicate)
    const isDuplicate = vocabulary.some((item, idx) =>
        item.word.toLowerCase() === word.toLowerCase() && (isEditing ? idx !== editingIndex : true)
    );

    if (isDuplicate) {
        alert('This word has already been added to your vocabulary!');
        return;
    }

    // Final validation: ensure definition is present after all attempts
    if (!definition || definition === 'Definition not found.' || definition === 'Error fetching definition.' || definition === 'Fetching definition...') {
        alert('Please provide a valid definition for the word, or try a different word. Definition could not be fetched automatically.');
        return;
    }

    const wordData = {
        word: word,
        definition: definition, // Use the (potentially updated) definition
        example: example,     // Use the (potentially updated) example
    };

    if (isEditing) {
        // Update existing word
        const originalWord = vocabulary[editingIndex];
        vocabulary[editingIndex] = {
            ...wordData, // New word, definition, example
            correctAttempts: originalWord.correctAttempts,
            totalAttempts: originalWord.totalAttempts,
            lastReviewed: originalWord.lastReviewed,
            // Reset SR level if the word itself was changed (treat as new for learning)
            srLevel: (originalWord.word.toLowerCase() !== word.toLowerCase()) ? 0 : originalWord.srLevel,
            nextReviewDate: (originalWord.word.toLowerCase() !== word.toLowerCase()) ? new Date().toISOString() : originalWord.nextReviewDate
        };
        isEditing = false;
        editingIndex = -1;
        addUpdateBtn.textContent = 'Add to Vocabulary'; // Reset button text
        console.log("Word Form Debug: Word updated:", word);
    } else {
        // Add new word
        vocabulary.push({
            ...wordData,
            correctAttempts: 0,
            totalAttempts: 0,
            lastReviewed: null,
            srLevel: 0, // New words start at level 0 (shortest interval)
            nextReviewDate: new Date().toISOString() // Ready for review immediately
        });
        console.log("Word Form Debug: New word added:", word);
    }

    saveVocabulary();
    displayVocabulary();
    wordForm.reset(); // Clear form fields
    wordInput.value = ''; // Ensure all fields are completely cleared
    definitionInput.value = '';
    exampleInput.value = '';
    initializeSentenceCorrector(); // Update sentence corrector section
    switchSection(vocabularyListSection); // Optionally switch to list view after adding
}

// Fetches definition and example from a dictionary API
async function fetchWordDetails(word) {
    if (!word) {
        definitionInput.value = '';
        exampleInput.value = '';
        console.log("Fetch Debug: No word provided for fetch.");
        return;
    }

    const currentFetchWord = word; // Capture word for this specific fetch

    // Determine if we should show 'Fetching...' placeholders
    const currentDefinition = definitionInput.value.trim();
    const currentExample = exampleInput.value.trim();
    const shouldShowFetchingPlaceholders =
        currentDefinition === '' || currentDefinition.startsWith('Definition not found') || currentDefinition.startsWith('Error fetching') || currentDefinition.startsWith('Fetching');

    if (shouldShowFetchingPlaceholders) {
        definitionInput.value = 'Fetching definition...';
        exampleInput.value = 'Fetching examples...';
        console.log("Fetch Debug: Showing fetching placeholders for word:", currentFetchWord);
    }

    try {
        const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${currentFetchWord}`);
        const data = await response.json();

        // Only update fields if the word input hasn't changed since this fetch started
        // and it matches the word we just fetched. Prevents overwriting new input.
        if (currentFetchWord === wordInput.value.trim()) {
            if (response.ok && data && data.length > 0) {
                const firstMeaning = data[0].meanings && data[0].meanings[0];
                const definition = firstMeaning && firstMeaning.definitions && firstMeaning.definitions[0].definition;
                let examples = firstMeaning && firstMeaning.definitions && firstMeaning.definitions[0].example;

                if (definition) {
                    definitionInput.value = definition;
                } else {
                    definitionInput.value = 'Definition not found.';
                }

                if (examples) {
                    exampleInput.value = examples;
                } else {
                    exampleInput.value = '(No example found for this definition.)';
                }
                console.log("Fetch Debug: Successfully fetched and set details for:", currentFetchWord);
            } else {
                definitionInput.value = 'Definition not found.';
                exampleInput.value = '(No example found for this word.)';
                console.warn(`Fetch Debug: Word "${currentFetchWord}" not found or API error:`, data);
            }
        } else {
            console.log("Fetch Debug: Input word changed during fetch for:", currentFetchWord, "Aborting update.");
        }
    } catch (error) {
        console.error('Fetch Debug: Error fetching word details:', error);
        if (currentFetchWord === wordInput.value.trim()) {
            definitionInput.value = 'Error fetching definition.';
            exampleInput.value = '(Error fetching example.)';
        }
    }
}

// Displays the vocabulary list on the page
function displayVocabulary() {
    console.log("Vocabulary List Debug: Displaying vocabulary. Current count:", vocabulary.length);
    vocabularyList.innerHTML = ''; // Clear current list

    if (vocabulary.length === 0) {
        vocabularyList.innerHTML = '<li style="text-align: center; color: #888;">No words added yet.</li>';
        return;
    }

    // Sort vocabulary alphabetically by word
    const sortedVocabulary = [...vocabulary].sort((a, b) => a.word.localeCompare(b.word));

    sortedVocabulary.forEach((item, index) => {
        const listItem = document.createElement('li');

        // Prepare next review date text
        const nextReviewDateObj = item.nextReviewDate ? new Date(item.nextReviewDate) : null;
        const nextReviewText = nextReviewDateObj && !isNaN(nextReviewDateObj) ?
            `Next review: ${nextReviewDateObj.toLocaleDateString()}` :
            'Ready for review';

        // Calculate performance for progress bar
        const performancePercentage = item.totalAttempts > 0 ? (item.correctAttempts / item.totalAttempts) * 100 : 0;
        let progressBarColor;

        if (performancePercentage >= 80) {
            progressBarColor = 'var(--primary-color)'; // Use primary color for high performance
        } else if (performancePercentage >= 50) {
            progressBarColor = 'var(--accent-color)'; // Use accent for medium
        } else {
            progressBarColor = 'var(--incorrect-feedback-text)'; // Use muted red for low
        }

        listItem.innerHTML = `
            <div class="word-content">
                <h3>
                    ${item.word}
                    <button class="play-audio-btn" data-text="${item.word}" title="Listen to word"><i class="fas fa-volume-up"></i></button>
                </h3>
                <p>${item.definition}</p>
                ${item.example && item.example !== '(No example found for this definition.)' && item.example !== '(No example found for this word.)' && item.example !== '(Error fetching example.)' ? `<p class="example-text">Example: ${item.example}</p>` : ''}
                <p class="stats-text">Performance: ${item.correctAttempts} / ${item.totalAttempts} correct | SR Level: ${item.srLevel !== undefined ? item.srLevel : 'N/A'} | ${nextReviewText}</p>
                <div class="progress-bar-container">
                    <div class="progress-bar" style="width: ${performancePercentage}%; background-color: ${progressBarColor};"></div>
                </div>
            </div>
            <button class="edit-btn" data-index="${vocabulary.indexOf(item)}" title="Edit word">Edit</button>
            <button class="remove-btn" data-index="${vocabulary.indexOf(item)}" title="Remove word"><i class="fas fa-trash-alt"></i></button>
        `;
        // IMPORTANT: Use vocabulary.indexOf(item) to get the original index in `vocabulary`
        // so that edit/remove operations affect the correct word even after sorting for display.

        vocabularyList.appendChild(listItem);
    });

    // Add event listeners to newly created buttons
    vocabularyList.querySelectorAll('.remove-btn').forEach(button => {
        button.addEventListener('click', removeWord);
    });

    vocabularyList.querySelectorAll('.edit-btn').forEach(button => {
        button.addEventListener('click', startEdit);
    });

    vocabularyList.querySelectorAll('.play-audio-btn').forEach(button => {
        button.addEventListener('click', playAudio);
    });

    checkWordsForExercise(); // Update exercise section visibility
    console.log("Vocabulary List Debug: Display complete.");
}

// Removes a word from the vocabulary
function removeWord(event) {
    const indexToRemove = parseInt(event.target.closest('button').dataset.index);
    if (confirm('Are you sure you want to remove this word?')) {
        vocabulary.splice(indexToRemove, 1);
        saveVocabulary();
        displayVocabulary();
        initializeSentenceCorrector(); // Update sentence corrector
        console.log("Vocabulary List Debug: Word removed at index:", indexToRemove);
    }
}

// Starts the editing process for a word
function startEdit(event) {
    editingIndex = parseInt(event.target.dataset.index);
    const wordToEdit = vocabulary[editingIndex];

    wordInput.value = wordToEdit.word;
    definitionInput.value = wordToEdit.definition;
    exampleInput.value = wordToEdit.example;

    isEditing = true;
    addUpdateBtn.textContent = 'Update Word';
    wordInput.focus();
    switchSection(addWordSection); // Switch to add/edit section
    console.log("Vocabulary List Debug: Starting edit for word at index:", editingIndex);
}

// ============================================================================
// Part 4: Memorization Exercise Functions and Spaced Repetition Logic
// ============================================================================

let currentFlashcardIndex = 0;
let isWordSide = true; // Tracks which side of the flashcard is showing
let wordsForTodayReview = []; // Words eligible for current review session
let shuffledVocabulary = []; // Words in the current shuffled session

// Checks if there are words to enable the exercise button
function checkWordsForExercise() {
    console.log("Flashcard Debug: Checking words for exercise. Vocabulary length:", vocabulary.length);
    if (vocabulary.length === 0) {
        startExerciseBtn.style.display = 'none';
        noWordsMessage.style.display = 'block';
        console.log("Flashcard Debug: No words in vocabulary. Exercise button hidden.");
    } else {
        startExerciseBtn.style.display = 'block';
        noWordsMessage.style.display = 'none';
        console.log("Flashcard Debug: Words found. Exercise button visible.");
    }
}

// Starts the flashcard exercise session
function startExercise() {
    console.log("Flashcard Debug: Starting exercise...");
    if (vocabulary.length === 0) {
        alert('Add some words to your vocabulary before starting the exercise!');
        console.log("Flashcard Debug: Vocabulary empty, cannot start exercise.");
        return;
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date to start of day

    const dueWords = vocabulary.filter(item => {
        // Handle potentially old data without SR properties
        if (item.srLevel === undefined || item.nextReviewDate === undefined || item.nextReviewDate === null) {
            item.srLevel = 0;
            item.nextReviewDate = new Date().toISOString();
            console.log(`Flashcard Debug: Initializing SR for "${item.word}".`);
            return true; // Treat as ready if properties are missing
        }

        const reviewDate = new Date(item.nextReviewDate);
        if (isNaN(reviewDate)) { // Handle invalid dates
            item.srLevel = 0;
            item.nextReviewDate = new Date().toISOString();
            console.warn(`Flashcard Debug: Invalid review date for "${item.word}", resetting SR.`);
            return true;
        }
        reviewDate.setHours(0, 0, 0, 0); // Normalize review date to start of day
        return reviewDate <= today;
    });

    console.log("Flashcard Debug: Words due for review today:", dueWords.length);

    if (dueWords.length === 0) {
        const confirmAllWords = confirm('No words are due for review today! Would you like to review all words in your vocabulary instead?');
        if (confirmAllWords) {
            wordsForTodayReview = vocabulary; // Review all if confirmed
            console.log("Flashcard Debug: User confirmed to review all words. Total words:", wordsForTodayReview.length);
        } else {
            flashcardContainer.style.display = 'none';
            startExerciseBtn.style.display = 'block';
            console.log("Flashcard Debug: User cancelled reviewing all words. Exercise aborted.");
            return;
        }
    } else {
        wordsForTodayReview = dueWords;
    }

    shuffledVocabulary = wordsForTodayReview.sort(() => Math.random() - 0.5); // Shuffle words
    console.log("Flashcard Debug: Shuffled vocabulary for current session:", shuffledVocabulary.length);

    if (shuffledVocabulary.length === 0) {
        alert('There are no words available for the exercise in this session. Add more words or wait for new words to be due!');
        flashcardContainer.style.display = 'none';
        startExerciseBtn.style.display = 'block';
        console.log("Flashcard Debug: Shuffled vocabulary is empty after filtering/shuffling. Exercise aborted.");
        return;
    }

    currentFlashcardIndex = 0;
    isWordSide = true; // Reset for a new session

    flashcardContainer.style.display = 'block';
    startExerciseBtn.style.display = 'none';

    feedbackButtonsContainer.style.display = 'none'; // Hide feedback initially
    nextCardBtn.style.display = 'none'; // Hide next card initially

    displayFlashcard(); // Show the first flashcard
    console.log("Flashcard Debug: Exercise started. Displaying first card.");
}

// Displays the current flashcard
function displayFlashcard() {
    console.log(`Flashcard Debug: Displaying flashcard. Index: ${currentFlashcardIndex}, Total words: ${shuffledVocabulary.length}`);
    if (shuffledVocabulary.length === 0 || currentFlashcardIndex >= shuffledVocabulary.length) {
        flashcardFront.textContent = "No words for the exercise.";
        flashcardBack.textContent = "";
        feedbackButtonsContainer.style.display = 'none';
        nextCardBtn.style.display = 'none';
        console.log("Flashcard Debug: No more words or invalid index. Exercise session likely ended.");
        return;
    }

    const currentWord = shuffledVocabulary[currentFlashcardIndex];
    console.log("Flashcard Debug: Current word to display:", currentWord.word);

    flashcard.classList.remove('flipped'); // Ensure card is not flipped
    isWordSide = true; // Crucial: Reset to word side for new card

    feedbackButtonsContainer.style.display = 'none';
    nextCardBtn.style.display = 'none';

    flashcardFront.innerHTML = `
        <span>${currentWord.word}</span>
        <button class="play-audio-btn flashcard-audio-btn" data-text="${currentWord.word}" title="Listen to word"><i class="fas fa-volume-up"></i></button>
    `;

    const fullTextForAudio = currentWord.definition + (currentWord.example &&
                                                       currentWord.example !== '(No example found for this definition.)' &&
                                                       currentWord.example !== '(No example found for this word.)' &&
                                                       currentWord.example !== '(Error fetching example.)' ? '. Example: ' + currentWord.example : '');
    flashcardBack.innerHTML = `
        <span>
            ${currentWord.definition}
            ${currentWord.example && currentWord.example !== '(No example found for this definition.)' && currentWord.example !== '(No example found for this word.)' && currentWord.example !== '(Error fetching example.)' ? `<br><small>(Example: ${currentWord.example})</small>` : ''}
        </span>
        <button class="play-audio-btn flashcard-audio-btn" data-text="${fullTextForAudio}" title="Listen to definition and example"><i class="fas fa-volume-up"></i></button>
    `;

    // Add event listeners for audio buttons after content is set
    setTimeout(() => {
        const frontAudioBtn = flashcardFront.querySelector('.play-audio-btn');
        const backAudioBtn = flashcardBack.querySelector('.play-audio-btn');
        if (frontAudioBtn) {
            frontAudioBtn.addEventListener('click', playAudio);
        } else {
            console.warn("Flashcard Debug: Front audio button element not found.");
        }
        if (backAudioBtn) {
            backAudioBtn.addEventListener('click', playAudio);
        } else {
            console.warn("Flashcard Debug: Back audio button element not found.");
        }
    }, 50);
    console.log("Flashcard Debug: Flashcard content updated.");
}

// Flips the flashcard
function flipFlashcard() {
    console.log("Flashcard Debug: Click detected on flashcard. Attempting to flip.");
    console.log("Flashcard Debug: Before flip - flashcard.classList:", flashcard.classList.value, "isWordSide:", isWordSide);
    flashcard.classList.toggle('flipped'); // Toggle the flipped class
    isWordSide = !isWordSide; // Invert the state
    console.log("Flashcard Debug: After flip - flashcard.classList:", flashcard.classList.value, "isWordSide:", isWordSide);

    // Show feedback buttons only when flipped to the back side (definition side)
    if (!isWordSide) { // If it's *not* the word side, meaning it's the definition side
        feedbackButtonsContainer.style.display = 'flex'; // Show the Correct/Incorrect buttons
        nextCardBtn.style.display = 'none'; // Keep Next Card hidden until feedback is given
        console.log("Flashcard Debug: Card flipped to back. Feedback buttons shown.");
    } else { // If it's the word side again
        feedbackButtonsContainer.style.display = 'none'; // Hide feedback buttons
        nextCardBtn.style.display = 'none'; // Hide Next Card button
        console.log("Flashcard Debug: Card flipped to front. Feedback/Next buttons hidden.");
    }
}

// Updates word stats based on correctness and spaced repetition logic
function updateVocabularyWordStats(currentWordObj, isCorrect) {
    console.log(`Flashcard Debug: Updating stats for "${currentWordObj.word}". Marked as ${isCorrect ? 'Correct' : 'Incorrect'}.`);
    // Find the actual index of the word in the original vocabulary array
    const originalWordIndex = vocabulary.findIndex(word => word.word === currentWordObj.word);

    if (originalWordIndex === -1) {
        console.error("Flashcard Debug: Error: Original word not found in vocabulary for update.", currentWordObj);
        return;
    }

    const wordToUpdate = vocabulary[originalWordIndex];

    wordToUpdate.totalAttempts++;
    wordToUpdate.lastReviewed = new Date().toISOString();

    if (isCorrect) {
        wordToUpdate.correctAttempts++;
        wordToUpdate.srLevel = (wordToUpdate.srLevel !== undefined ? wordToUpdate.srLevel : 0) + 1;
        wordToUpdate.srLevel = Math.min(wordToUpdate.srLevel, SR_INTERVALS.length - 1); // Cap SR level
    } else {
        wordToUpdate.srLevel = 0; // Reset level if incorrect
    }

    const intervalDays = SR_INTERVALS[wordToUpdate.srLevel];
    const nextDate = new Date();
    nextDate.setDate(nextDate.getDate() + intervalDays);
    wordToUpdate.nextReviewDate = nextDate.toISOString();

    saveVocabulary();
    displayVocabulary(); // Refresh the list display
    console.log(`Flashcard Debug: Stats updated for "${wordToUpdate.word}". New SR Level: ${wordToUpdate.srLevel}, Next Review: ${wordToUpdate.nextReviewDate}.`);
}

// Marks the current word as correct
function markCorrect() {
    console.log("Flashcard Debug: 'Correct' button clicked.");
    const currentWordObj = shuffledVocabulary[currentFlashcardIndex];
    updateVocabularyWordStats(currentWordObj, true);

    nextCardBtn.style.display = 'block'; // Show Next Card button
    feedbackButtonsContainer.style.display = 'none'; // Hide feedback buttons
    console.log("Flashcard Debug: Next Card button shown, feedback hidden.");
}

// Marks the current word as incorrect
function markIncorrect() {
    console.log("Flashcard Debug: 'Incorrect' button clicked.");
    const currentWordObj = shuffledVocabulary[currentFlashcardIndex];
    updateVocabularyWordStats(currentWordObj, false);

    nextCardBtn.style.display = 'block';
    feedbackButtonsContainer.style.display = 'none';
    console.log("Flashcard Debug: Next Card button shown, feedback hidden.");
}

// Moves to the next flashcard
function nextFlashcard() {
    console.log("Flashcard Debug: 'Next Card' button clicked.");
    currentFlashcardIndex++;

    feedbackButtonsContainer.style.display = 'none';
    nextCardBtn.style.display = 'none';

    if (currentFlashcardIndex >= shuffledVocabulary.length) {
        alert('You have reviewed all words in this session! Starting a new session with your current vocabulary.');
        console.log("Flashcard Debug: End of session. Restarting exercise.");
        startExercise(); // Restart exercise to get new set of words
        return;
    }

    displayFlashcard();
    console.log(`Flashcard Debug: Moving to next card (index ${currentFlashcardIndex}).`);
}

// ============================================================================
// Part 5: Audio Functionality (Web Speech API)
// ============================================================================

const synth = window.speechSynthesis; // Web Speech API

// Plays the given text as speech
function playAudio(event) {
    if (synth.speaking) {
        synth.cancel(); // Stop any ongoing speech
    }

    const textToSpeak = event.currentTarget.dataset.text;
    console.log("Audio Debug: Playing audio for:", textToSpeak);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'en-US'; // Set language to English (US)
    utterance.rate = 0.9; // Slightly slower speed
    utterance.pitch = 1; // Normal pitch

    synth.speak(utterance);
}

// ============================================================================
// Part 6: Sentence Corrector Functions
// ============================================================================

// Initializes the sentence corrector section
function initializeSentenceCorrector() {
    console.log("Sentence Corrector Debug: Initializing.");
    if (vocabulary.length === 0) {
        wordToUseDisplay.textContent = 'Please add words to your vocabulary to use this feature.';
        getNewWordBtn.style.display = 'none';
        sentenceInput.disabled = true;
        checkSentenceBtn.disabled = true;
        correctionOutput.textContent = '';
        correctionOutput.classList.remove('correct-feedback', 'incorrect-feedback');
        currentRequiredWord = null;
        console.log("Sentence Corrector Debug: No words in vocab, feature disabled.");
    } else {
        getNewWordBtn.style.display = 'block';
        getNewWordForSentence(); // Get initial word for the sentence
        console.log("Sentence Corrector Debug: Words found, feature enabled.");
    }
}

// Gets a new random word for the sentence corrector
function getNewWordForSentence() {
    console.log("Sentence Corrector Debug: Getting new word.");
    if (vocabulary.length === 0) {
        alert('Please add words to your vocabulary first!');
        initializeSentenceCorrector();
        return;
    }

    const randomIndex = Math.floor(Math.random() * vocabulary.length);
    currentRequiredWord = vocabulary[randomIndex].word; // Select a random word

    wordToUseDisplay.innerHTML = `Your word to use: <strong>"${currentRequiredWord}"</strong>. Write a sentence using this word.`;

    sentenceInput.disabled = false;
    checkSentenceBtn.disabled = false;
    sentenceInput.value = ''; // Clear previous sentence
    correctionOutput.textContent = ''; // Clear previous feedback
    correctionOutput.classList.remove('correct-feedback', 'incorrect-feedback');
    sentenceInput.focus();
    console.log("Sentence Corrector Debug: New word selected:", currentRequiredWord);
}

// Checks the user's sentence for the required word and basic grammar
function checkSentence() {
    console.log("Sentence Corrector Debug: Checking sentence.");
    const sentence = sentenceInput.value.trim();

    if (currentRequiredWord === null) {
        correctionOutput.textContent = 'A word was not selected. Click "New Word" to get one.';
        correctionOutput.classList.remove('correct-feedback', 'incorrect-feedback');
        console.log("Sentence Corrector Debug: No required word set.");
        return;
    }

    if (sentence === '') {
        correctionOutput.textContent = 'Please enter a sentence to check.';
        correctionOutput.classList.remove('correct-feedback', 'incorrect-feedback');
        console.log("Sentence Corrector Debug: Empty sentence input.");
        return;
    }

    let isCorrect = true;
    let feedbackMessage = '';
    let correctionDetails = [];

    const lowerCaseSentence = sentence.toLowerCase();
    const lowerCaseRequiredWord = currentRequiredWord.toLowerCase();

    // 1. Check for presence of the required word (whole word match)
    const regex = new RegExp(`\\b${lowerCaseRequiredWord}\\b`, 'i'); // 'i' for case-insensitive
    if (!regex.test(lowerCaseSentence)) {
        isCorrect = false;
        correctionDetails.push(`Your sentence must contain the word "${currentRequiredWord}".`);
    }

    // 2. Placeholder AI Correction Logic (simple grammar checks)
    // Add more sophisticated checks here as your app grows
    if (lowerCaseSentence.includes('me go')) {
        isCorrect = false;
        const correctedGrammar = sentence.replace(/me go/gi, 'I go');
        correctionDetails.push(`Grammar correction: "${correctedGrammar}".`);
    }
    if (!/[.!?]$/.test(sentence)) { // Check for ending punctuation
        isCorrect = false;
        correctionDetails.push(`Punctuation: Don't forget to end your sentence with a period, question mark, or exclamation point.`);
    }

    if (isCorrect) {
        feedbackMessage = `Fantastic! Your sentence is perfect and uses "${currentRequiredWord}"! 🎉`;
        console.log("Sentence Corrector Debug: Sentence is correct.");
    } else {
        feedbackMessage = `Your sentence needs some adjustments:<br><ul><li>${correctionDetails.join('</li><li>')}</li></ul>`;
        console.log("Sentence Corrector Debug: Sentence incorrect. Details:", correctionDetails);
    }

    correctionOutput.innerHTML = feedbackMessage;
    correctionOutput.classList.remove('correct-feedback', 'incorrect-feedback');
    if (isCorrect) {
        correctionOutput.classList.add('correct-feedback');
    } else {
        correctionOutput.classList.add('incorrect-feedback');
    }
}


// ============================================================================
// Part 7: Navigation Functions and Event Listeners
// ============================================================================

// Function to switch between sections
function switchSection(sectionToShow) {
    console.log("Navigation Debug: Switching section to", sectionToShow.id);
    const sections = [addWordSection, vocabularyListSection, exerciseSection, sentenceCorrectorSection];
    sections.forEach(section => {
        section.classList.remove('active');
        section.classList.add('hidden');
    });
    sectionToShow.classList.remove('hidden');
    sectionToShow.classList.add('active');

    // Re-initialize relevant sections when switching to them
    if (sectionToShow === exerciseSection) {
        startExercise(); // Start exercise whenever its section is shown
    } else if (sectionToShow === sentenceCorrectorSection) {
        initializeSentenceCorrector(); // Initialize sentence corrector
    } else if (sectionToShow === vocabularyListSection) {
        displayVocabulary(); // Ensure list is up-to-date
    }
}

// Event Listeners for main navigation
showAddWordSectionBtn.addEventListener('click', () => switchSection(addWordSection));
showVocabularyListSectionBtn.addEventListener('click', () => switchSection(vocabularyListSection));
showExerciseSectionBtn.addEventListener('click', () => switchSection(exerciseSection));
showSentenceCorrectorSectionBtn.addEventListener('click', () => switchSection(sentenceCorrectorSection));

// Event Listener for word form submission
wordForm.addEventListener('submit', handleAddUpdateWord);

// Event Listeners for fetching word details (on blur and debounced input)
wordInput.addEventListener('blur', (event) => {
    if (!isEditing || (isEditing && event.target.value.trim().toLowerCase() !== vocabulary[editingIndex]?.word.toLowerCase())) {
        fetchWordDetails(event.target.value.trim());
    }
});

let fetchTimer; // Timer for debouncing input
wordInput.addEventListener('input', (event) => {
    clearTimeout(fetchTimer);
    if (!isEditing || (isEditing && event.target.value.trim().toLowerCase() !== vocabulary[editingIndex]?.word.toLowerCase())) {
        fetchTimer = setTimeout(() => {
            fetchWordDetails(event.target.value.trim());
        }, 800); // 800ms debounce time
    }
});

// New: Event listener for the audio button in the Add Word section
addWordAudioBtn.addEventListener('click', (event) => {
    event.preventDefault(); // Prevent form submission
    const textToSpeak = wordInput.value.trim();
    if (textToSpeak) {
        playAudio({ currentTarget: { dataset: { text: textToSpeak } } });
    }
});

// Event Listeners for flashcard exercise
startExerciseBtn.addEventListener('click', startExercise);
flashcard.addEventListener('click', flipFlashcard); // This is the crucial listener for flipping
correctBtn.addEventListener('click', markCorrect);
incorrectBtn.addEventListener('click', markIncorrect);
nextCardBtn.addEventListener('click', nextFlashcard);

// Event Listeners for sentence corrector
getNewWordBtn.addEventListener('click', getNewWordForSentence);
checkSentenceBtn.addEventListener('click', checkSentence);


// ============================================================================
// Part 8: Initialization
// ============================================================================

// Initial calls when the page loads
displayVocabulary(); // Show words on page load
checkWordsForExercise(); // Update exercise button state
initializeSentenceCorrector(); // Prepare the sentence corrector
// Start on the "Add Word" section by default
switchSection(addWordSection); // Ensure initial section is active
console.log("App initialized.");