define([
  'core/js/adapt',
  'core/js/views/componentView',
  './modeEnum'
], function(Adapt, ComponentView, MODE) {
  'use strict';

  var ScenarioAudioView = ComponentView.extend({

    _isInitial: true,

    events: {
      'click .scenario-audio-strapline-title': 'openPopup',
      'click .scenario-audio-controls': 'onNavigationClicked',
      'click .scenario-audio-indicators .scenario-audio-progress': 'onProgressClicked'
    },

    preRender: function() {
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
    },

    onItemsActiveChange: function(item, _isActive) {
      if (_isActive === true) {
        this.setStage(item);
      }
    },

    onItemsVisitedChange: function(item, isVisited) {
      if (!isVisited) return;
      this.$('[data-index="' + item.get('_index') + '"]').addClass('visited');
    },

    calculateMode: function() {
      var mode = Adapt.device.screenSize === 'large' ?
        MODE.LARGE :
        MODE.SMALL;
      this.model.set('_mode', mode);
    },

    renderMode: function() {
      this.calculateMode();
      if (this.isLargeMode()) {
        this.$el.addClass('mode-large').removeClass('mode-small');

        if (this.model.get('instruction') == "") {
          this.$el.addClass('remove-instruction');
        }
      } else {
        this.$el.addClass('mode-small').removeClass('mode-large');
        this.$el.removeClass('remove-instruction');
      }
    },

    isLargeMode: function() {
      return this.model.get('_mode') === MODE.LARGE;
    },

    postRender: function() {
      this.renderMode();
      this.setupScenarioAudio();

      this.$('.scenario-audio-slider').imageready(this.setReadyStatus.bind(this));

      if (Adapt.config.get('_disableAnimation')) {
        this.$el.addClass('disable-animation');
      }
    },

    checkIfResetOnRevisit: function() {
      var isResetOnRevisit = this.model.get('_isResetOnRevisit');
      // If reset is enabled set defaults
      if (isResetOnRevisit) {
        this.model.reset(isResetOnRevisit);
      }
    },

    setupScenarioAudio: function() {
      this.renderMode();
      var items = this.model.getChildren();
      if (!items || !items.length) return;

      var activeItem = this.model.getActiveItem();
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
    },

    calculateWidths: function() {
      var itemCount = this.model.getChildren().length;
      this.model.set({
        '_totalWidth': 100 * itemCount,
        '_itemWidth': 100 / itemCount
      });
    },

    resizeControl: function() {
      var previousMode = this.model.get('_mode');
      this.renderMode();
      if (previousMode !== this.model.get('_mode')) this.replaceInstructions();
      this.evaluateNavigation();
      var activeItem = this.model.getActiveItem();
      if (activeItem) this.setStage(activeItem);
    },

    reRender: function() {
      this.resizeControl();
    },

    closeNotify: function() {
      this.evaluateCompletion()
    },

    replaceInstructions: function() {
      if (this.isLargeMode()) {
        this.$('.scenario-audio-instruction-inner').html(this.model.get('instruction'));
      } else if (this.model.get('mobileInstruction')) {
        this.$('.scenario-audio-instruction-inner').html(this.model.get('mobileInstruction'));
      }
    },

    moveSliderToIndex: function(itemIndex) {
      var offset = this.model.get('_itemWidth') * itemIndex;
      if (Adapt.config.get('_defaultDirection') === 'ltr') {
        offset *= -1;
      }
      var cssValue = 'translateX(' + offset + '%)';
      var $sliderElm = this.$('.scenario-audio-slider');
      var $straplineHeaderElm = this.$('.scenario-audio-strapline-header-inner');

      $sliderElm.css('transform', cssValue);
      $straplineHeaderElm.css('transform', cssValue);

      if (Adapt.config.get('_disableAnimation') || this._isInitial) {
        this.onTransitionEnd();
      } else {
        $sliderElm.one('transitionend', this.onTransitionEnd.bind(this));
      }
    },

    onTransitionEnd: function() {
      if (this._isInitial) return;

      var index = this.model.getActiveItem().get('_index');
      if (this.isLargeMode()) {
        Adapt.a11y.focusFirst(this.$('.scenario-audio-content-item[data-index="' + index + '"]'));
      } else {
        Adapt.a11y.focusFirst(this.$('.scenario-audio-strapline-title'));
      }
    },

    setStage: function(item) {
      var index = item.get('_index');
      if (this.isLargeMode()) {
        // Set the visited attribute for large screen devices
        item.toggleVisited(true);
      }

      var $slideGraphics = this.$('.scenario-audio-slider-graphic');
      var $contentItem = this.$('.scenario-audio-content-item');
      var $straplineTitle = this.$('.scenario-audio-strapline-title');
      this.$('.scenario-audio-progress:visible').removeClass('selected').filter('[data-index="' + index + '"]').addClass('selected');
      Adapt.a11y.toggleAccessibleEnabled($slideGraphics.children('.controls'), false);
      Adapt.a11y.toggleAccessibleEnabled($slideGraphics.filter('[data-index="' + index + '"]').children('.controls'), true);
      $contentItem.addClass('scenario-audio-hidden').filter('[data-index="' + index + '"]').removeClass('scenario-audio-hidden');
      Adapt.a11y.toggleAccessibleEnabled($contentItem, false);
      Adapt.a11y.toggleAccessibleEnabled($contentItem.filter('[data-index="' + index + '"]'), true);
      Adapt.a11y.toggleAccessibleEnabled($straplineTitle, false);
      Adapt.a11y.toggleAccessibleEnabled($straplineTitle.filter('[data-index="' + index + '"]'), true);

      this.evaluateNavigation();
      this.evaluateCompletion();
      this.moveSliderToIndex(index);
    },

    evaluateNavigation: function() {
      var active = this.model.getActiveItem();
      if (!active) return;

      var currentStage = active.get('_index');
      var itemCount = this.model.getChildren().length;

      var isAtStart = currentStage === 0;
      var isAtEnd = currentStage === itemCount - 1;

      this.$('.scenario-audio-control-left').toggleClass('scenario-audio-hidden', isAtStart);
      this.$('.scenario-audio-control-right').toggleClass('scenario-audio-hidden', isAtEnd);
    },

    evaluateCompletion: function() {
      if (this.model.areAllItemsCompleted()) {
        this.trigger('allItems');
      }
    },

    openPopup: function(event) {
      event && event.preventDefault();

      var currentItem = this.model.getActiveItem();

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
    },

    onNavigationClicked: function(event) {
      var stage = this.model.getActiveItem().get('_index');

      if ($(event.currentTarget).hasClass('scenario-audio-control-right')) {
        this.model.setActiveItem(++stage);
      } else if ($(event.currentTarget).hasClass('scenario-audio-control-left')) {
        this.model.setActiveItem(--stage);
      }

      if (!Adapt.audio) return;
      if (Adapt.device.screenSize === 'large') {
        var currentItem = this.model.getActiveItem();

        if (this.model.has('_audio') && this.model.get('_audio')._isEnabled && Adapt.audio.audioClip[this.model.get('_audio')._channel].status == 1) {
          Adapt.audio.audioClip[this.model.get('_audio')._channel].onscreenID = "";
          Adapt.trigger('audio:playAudio', currentItem.get('_audio').src, this.model.get('_id'), this.model.get('_audio')._channel);
        }
      }
    },

    onProgressClicked: function(event) {
      event && event.preventDefault();
      var clickedIndex = $(event.target).data('index');
      this.model.setActiveItem(clickedIndex);
    },

    setupEventListeners: function() {
      if (this.model.get('_setCompletionOn') === 'inview') {
        this.setupInviewCompletion('.component__widget');
      }
    },

    // Reduced text
    replaceText: function(value) {
      // If enabled
      if (this.model.get('_audio') && this.model.get('_audio')._reducedTextisEnabled) {
        // Change each items title and body
        for (var i = 0; i < this.model.get('_items').length; i++) {
          if (value == 0) {
            this.$('.scenario-audio-content-title-inner').eq(i).html(this.model.get('_items')[i].title);
            this.$('.scenario-audio-content-body-inner').eq(i).html(this.model.get('_items')[i].body);
          } else {
            this.$('.scenario-audio-content-title-inner').eq(i).html(this.model.get('_items')[i].titleReduced);
            this.$('.scenario-audio-content-body-inner').eq(i).html(this.model.get('_items')[i].bodyReduced);
          }
        }
      }
    }

  });

  return ScenarioAudioView;

});
