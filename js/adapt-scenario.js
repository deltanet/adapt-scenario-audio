import Adapt from 'core/js/adapt';
import ScenarioModel from './scenarioModel';
import ScenarioView from './scenarioView';

export default Adapt.register('scenario-audio', {
  model: ScenarioModel,
  view: ScenarioView
});
