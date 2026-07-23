





export function localStoreSave(obj, key = 'state') {
    try {
        const serializedData = JSON.stringify(obj);
        localStorage.setItem(key, serializedData);
        return true; // Indicates successful save
    } catch (error) {
        console.error(`Failed to save to localStorage under key "${key}":`, error);

        // Specific check for storage full
        if (error.name === 'QuotaExceededError' || error.code === 22) {
            console.error('Storage limit exceeded! Please clear up some space.');
        }

        return false; // Indicates failure
    }
}

export function localStoreLoad(key = 'state') {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : undefined;
    } catch (error) {
        console.error(`Error parsing localStorage key "${key}":`, error);
        return undefined; // Fallback gracefully
    }
}