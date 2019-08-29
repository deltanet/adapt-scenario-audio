define([
    'core/js/adapt',
    './scenarioAudioView',
    'core/js/models/itemsComponentModel'
], function(Adapt, ScenarioAudioView, ItemsComponentModel) {

    return Adapt.register('scenario-audio', {
        model: ItemsComponentModel,
        view: ScenarioAudioView
    });

});
