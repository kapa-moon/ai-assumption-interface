Qualtrics.SurveyEngine.addOnload(function() {
    // Listen for messages from the chat iframe
    window.addEventListener('message', function(event) {
        // Optional: verify origin
        // if (event.origin !== 'https://your-domain.com') return;
        
        const data = event.data;
        
        // Store individual turn data
        if (data.type === 'SET_EMBEDDED_DATA') {
            Qualtrics.SurveyEngine.setEmbeddedData(data.field, data.value);
            
            // Also track turn count
            const turnMatch = data.field.match(/chat_data_(\d+)/);
            if (turnMatch) {
                const turnNum = parseInt(turnMatch[1]);
                const currentMax = parseInt(Qualtrics.SurveyEngine.getEmbeddedData('turn_count') || '0');
                if (turnNum > currentMax) {
                    Qualtrics.SurveyEngine.setEmbeddedData('turn_count', turnNum);
                }
            }
        }
        
        // Handle completion signal
        if (data.type === 'CHAT_COMPLETE') {
            Qualtrics.SurveyEngine.setEmbeddedData('chat_complete', 'true');
            Qualtrics.SurveyEngine.setEmbeddedData('session_id', data.sessionId);
            if (data.turnCount) {
                Qualtrics.SurveyEngine.setEmbeddedData('turn_count', data.turnCount);
            }
            
            // Auto-advance to next question
            jQuery('#NextButton').click();
        }
    });
});