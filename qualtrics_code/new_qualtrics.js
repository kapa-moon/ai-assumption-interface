Qualtrics.SurveyEngine.addOnload(function() {
    window.addEventListener('message', function(event) {
        if (event.origin !== 'https://ai-assumption-interface.vercel.app') return;
        
        var data = event.data;
        
        if (data.type === 'SET_EMBEDDED_DATA') {
            Qualtrics.SurveyEngine.setEmbeddedData(data.field, data.value);
            
            var turnMatch = data.field.match(/chat_data_(\d+)/);
            if (turnMatch) {
                var turnNum = parseInt(turnMatch[1]);
                var currentMax = parseInt(Qualtrics.SurveyEngine.getEmbeddedData('turn_count') || '0');
                if (turnNum > currentMax) {
                    Qualtrics.SurveyEngine.setEmbeddedData('turn_count', turnNum);
                }
            }
        }
        
        if (data.type === 'CHAT_COMPLETE') {
            Qualtrics.SurveyEngine.setEmbeddedData('chat_complete', 'true');
            if (data.turnCount) {
                Qualtrics.SurveyEngine.setEmbeddedData('turn_count', data.turnCount);
            }
            jQuery('#NextButton').click();
        }
    });
});