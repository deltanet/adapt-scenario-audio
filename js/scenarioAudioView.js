define([
  'core/js/adapt',
  'core/js/views/componentView',
  './modeEnum'
], function(Adapt, ComponentView, MODE) {

  class ScenarioAudioView extends ComponentView {

    events() {
      return {
        'click .js-scenario-audio-strapline-open-popup': 'openPopup',
        'click .js-scenario-audio-controls-click': 'onNavigationClicked',
        'click .js-scenario-audio-progress-click': 'onProgressClicked'
      };
    }

    initialize(...args) {
      super.initialize(...args);

      this._isInitial = true;
    }

    preRender() {
      this.listenTo(Adapt, {
        'device:changed device:resize': this.reRender,
        'notify:closed': this.closeNotify
      });
      this.renderMode();

      this.listenTo(this.model.getChildren(), {
        'change:_isActive': this.onItemsActiveChange,
        'change:_isVisited': this.onItemsVisitedChange
      });

      // Listen for text change on audio extension
      this.listenTo(Adapt, "audio:changeText", this.replaceText);

      this.checkIfResetOnRevisit();
      this.calculateWidths();
    }

    onItemsActiveChange(item, _isActive) {
      if (!_isActive) return;
      this.setStage(item);
      this.setFocus(item.get('_index'));
    }

    setFocus(itemIndex) {
      if (this._isInitial) return;
      const $straplineHeaderElm = this.$('.scenario-audio__strapline-header-inner');
      const hasStraplineTransition = !this.isLargeMode() && ($straplineHeaderElm.css('transitionDuration') !== '0s');
      if (hasStraplineTransition) {
        $straplineHeaderElm.one('transitionend', () => {
          this.focusOnScenarioElement(itemIndex);
        });
        return;
      }

      this.focusOnScenarioElement(itemIndex);
    }

    focusOnScenarioElement(itemIndex) {
      const dataIndexAttr = `[data-index='${itemIndex}']`;
      const $elementToFocus = this.isLargeMode() ?
        this.$(`.scenario-audio__content-item${dataIndexAttr}`) :
        this.$(`.scenario-audio__strapline-btn${dataIndexAttr}`);
      Adapt.a11y.focusFirst($elementToFocus);
    }

    onItemsVisitedChange(item, _isVisited) {
      if (!_isVisited) return;
      this.$(`[data-index="${item.get('_index')}"]`).addClass('is-visited');
    }

    calculateMode() {
      const mode = Adapt.device.screenSize === 'large' ? MODE.LARGE : MODE.SMALL;
      this.model.set('_mode', mode);
    }

    renderMode() {
      this.calculateMode();

      const isLargeMode = this.isLargeMode();
      this.$el.toggleClass('mode-large', isLargeMode).toggleClass('mode-small', !isLargeMode);
    }

    isLargeMode() {
      return this.model.get('_mode') === MODE.LARGE;
    }

    postRender() {
      this.renderMode();
      this.setupScenario();

      this.$('.scenario-audio__slider').imageready(this.setReadyStatus.bind(this));

      if (Adapt.config.get('_disableAnimation')) {
        this.$el.addClass('disable-animation');
      }
    }

    checkIfResetOnRevisit() {
      const isResetOnRevisit = this.model.get('_isResetOnRevisit');
      // If reset is enabled set defaults
      if (isResetOnRevisit) {
        this.model.reset(isResetOnRevisit);
      }
    }

    setupScenario() {
      this.renderMode();
      const items = this.model.getChildren();
      if (!items || !items.length) return;

      let activeItem = this.model.getActiveItem();
      if (!activeItem) {
        activeItem = this.model.getItem(0);
        activeItem.toggleActive(true);
      } else {
        // manually trigger change as it is not fired on reentry
        items.trigger('change:_isActive', activeItem, true);
      }

      this.calculateWidths();

      if (!this.isLargeMode()) {
        this.replaceInstructions();
      }
      this.setupEventListeners();
      this._isInitial = false;

      if (Adapt.audio && this.model.get('_audio') && this.model.get('_audio')._reducedTextisEnabled) {
        this.replaceText(Adapt.audio.textSize);
      }
    }

    calculateWidths() {
      const itemCount = this.model.getChildren().length;
      this.model.set({
        _totalWidth: 100 * itemCount,
        _itemWidth: 100 / itemCount
      });
    }

    resizeControl() {
      const previousMode = this.model.get('_mode');
      this.renderMode();
      if (previousMode !== this.model.get('_mode')) this.replaceInstructions();
      this.evaluateNavigation();
      const activeItem = this.model.getActiveItem();
      if (activeItem) this.setStage(activeItem);
    }

    reRender() {
      this.resizeControl();
    }

    closeNotify() {
      this.evaluateCompletion()
    }

    replaceInstructions() {
      if (this.isLargeMode()) {
        this.$('.scenario-audio__instruction-inner').html(this.model.get('instruction'));
      } else if (this.model.get('mobileInstruction')) {
        this.$('.scenario-audio__instruction-inner').html(this.model.get('mobileInstruction'));
      }
    }

    moveSliderToIndex(itemIndex) {
      let offset = this.model.get('_itemWidth') * itemIndex;
      if (Adapt.config.get('_defaultDirection') === 'ltr') {
        offset *= -1;
      }
      const cssValue = `translateX(${offset}%)`;
      const $sliderElm = this.$('.scenario-audio__slider');
      const $straplineHeaderElm = this.$('.scenario-audio__strapline-header-inner');

      $sliderElm.css('transform', cssValue);
      $straplineHeaderElm.css('transform', cssValue);
    }

    setStage(item) {
      const index = item.get('_index');
      const indexSelector = `[data-index="${index}"]`;

      if (this.isLargeMode()) {
        // Set the visited attribute for large screen devices
        item.toggleVisited(true);
      }

      this.$('.scenario-audio__progress').removeClass('is-selected').filter(indexSelector).addClass('is-selected');

      const $slideGraphics = this.$('.scenario-audio__slider-image-container');
      Adapt.a11y.toggleAccessibleEnabled($slideGraphics.children('.controls'), false);
      Adapt.a11y.toggleAccessibleEnabled($slideGraphics.filter(indexSelector).children('.controls'), true);

      const $scenarioItems = this.$('.scenario-audio__content-item');
      $scenarioItems.addClass('u-visibility-hidden u-display-none');
      Adapt.a11y.toggleAccessible($scenarioItems, false);
      Adapt.a11y.toggleAccessible($scenarioItems.filter(indexSelector).removeClass('u-visibility-hidden u-display-none'), true);

      const $scenarioStraplineButtons = this.$('.scenario-audio__strapline-btn');
      Adapt.a11y.toggleAccessibleEnabled($scenarioStraplineButtons, false);
      Adapt.a11y.toggleAccessibleEnabled($scenarioStraplineButtons.filter(indexSelector), true);

      this.evaluateNavigation();
      this.evaluateCompletion();
      this.moveSliderToIndex(index);
    }

    evaluateNavigation() {
      const active = this.model.getActiveItem();
      if (!active) return;

      const index = active.get('_index');
      const itemCount = this.model.getChildren().length;

      const isAtStart = index === 0;
      const isAtEnd = index === itemCount - 1;

      const $left = this.$('.scenario-audio__controls-left');
      const $right = this.$('.scenario-audio__controls-right');

      const globals = Adapt.course.get('_globals');

      const ariaLabelsGlobals = globals._accessibility._ariaLabels;
      //const scenarioGlobals = globals._components._scenario-audio;

      const ariaLabelPrevious = ariaLabelsGlobals.previous;
      const ariaLabelNext = ariaLabelsGlobals.next;

      const prevTitle = isAtStart ? '' : this.model.getItem(index - 1).get('title');
      const nextTitle = isAtEnd ? '' : this.model.getItem(index + 1).get('title');

      $left.toggleClass('u-visibility-hidden', isAtStart);
      $right.toggleClass('u-visibility-hidden', isAtEnd);

      $left.attr('aria-label', Handlebars.compile(ariaLabelPrevious)({
        title: prevTitle,
        _globals: globals,
        itemNumber: isAtStart ? null : index,
        totalItems: itemCount
      }));
      $right.attr('aria-label', Handlebars.compile(ariaLabelNext)({
        title: nextTitle,
        _globals: globals,
        itemNumber: isAtEnd ? null : index + 2,
        totalItems: itemCount
      }));
    }

    evaluateCompletion() {
      if (this.model.areAllItemsCompleted()) {
        this.trigger('allItems');
      }
    }

    openPopup() {
      const currentItem = this.model.getActiveItem();

      // Set popup text to default full size
      var itemTitle = currentItem.get('title');
      var itemBody = currentItem.get('body');

      // If reduced text is enabled and selected
      if (Adapt.audio && this.model.get('_audio') && this.model.get('_audio')._reducedTextisEnabled && Adapt.audio.textSize == 1) {
        itemTitle = currentItem.get('titleReduced');
        itemBody = currentItem.get('bodyReduced');
      }

      Adapt.notify.popup({
        title: itemTitle,
        body: itemBody
      });

      Adapt.on('popup:opened', function() {
        // Set the visited attribute for small and medium screen devices
        currentItem.toggleVisited(true);
      });

      if (!Adapt.audio) return;

      if (this.model.has('_audio') && this.model.get('_audio')._isEnabled && Adapt.audio.audioClip[this.model.get('_audio')._channel].status == 1) {
        Adapt.audio.audioClip[this.model.get('_audio')._channel].onscreenID = "";
        Adapt.trigger('audio:playAudio', currentItem.get('_audio').src, this.model.get('_id'), this.model.get('_audio')._channel);
      }
    }

    onNavigationClicked(event) {
      const $btn = $(event.currentTarget);
      let index = this.model.getActiveItem().get('_index');
      $btn.data('direction') === 'right' ? index++ : index--;
      this.model.setActiveItem(index);

      if (!Adapt.audio) return;
      if (Adapt.device.screenSize === 'large') {
        var currentItem = this.model.getActiveItem();

        if (this.model.has('_audio') && this.model.get('_audio')._isEnabled && Adapt.audio.audioClip[this.model.get('_audio')._channel].status == 1) {
          Adapt.audio.audioClip[this.model.get('_audio')._channel].onscreenID = "";
          Adapt.trigger('audio:playAudio', currentItem.get('_audio').src, this.model.get('_id'), this.model.get('_audio')._channel);
        }
      }
    }

    onProgressClicked(event) {
      const index = $(event.target).data('index');
      this.model.setActiveItem(index);
    }

    setupEventListeners() {
      if (this.model.get('_setCompletionOn') === 'inview') {
        this.setupInviewCompletion('.component__widget');
      }
    }

    // Reduced text
    replaceText(value) {
      // If enabled
      if (this.model.get('_audio') && this.model.get('_audio')._reducedTextisEnabled) {
        // Change each items title and body
        for (var i = 0; i < this.model.get('_items').length; i++) {
          if (value == 0) {
            this.$('.scenario-audio__content-title-inner').eq(i).html(this.model.get('_items')[i].title);
            this.$('.scenario-audio__content-body-inner').eq(i).html(this.model.get('_items')[i].body);
          } else {
            this.$('.scenario-audio__content-title-inner').eq(i).html(this.model.get('_items')[i].titleReduced);
            this.$('.scenario-audio__content-body-inner').eq(i).html(this.model.get('_items')[i].bodyReduced);
          }
        }
      }
    }
  }

  ScenarioAudioView.template = 'scenario-audio';

  return ScenarioAudioView;

});
