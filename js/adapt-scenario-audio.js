define(function(require) {

    var ComponentView = require('coreViews/componentView');
    var Adapt = require('coreJS/adapt');

    var ScenarioAudio = ComponentView.extend({

        events: {
            'click .scenario-audio-strapline-title': 'openPopup',
            'click .scenario-audio-controls': 'onNavigationClicked',
            'click .scenario-audio-indicators .scenario-audio-progress': 'onProgressClicked'
        },

        preRender: function() {
            this.listenTo(Adapt, 'device:changed', this.reRender, this);
            this.listenTo(Adapt, 'device:resize', this.resizeControl, this);
            this.listenTo(Adapt, 'notify:closed', this.closeNotify, this);
            // Listen for text change on audio extension
            this.listenTo(Adapt, "audio:changeText", this.replaceText);

            this.setDeviceSize();

            // Checks to see if the scenario-audio should be reset on revisit
            this.checkIfResetOnRevisit();
        },

        setDeviceSize: function() {
            if (Adapt.device.screenSize === 'large') {
                this.$el.addClass('desktop').removeClass('mobile');
                this.model.set('_isDesktop', true);
            } else {
                this.$el.addClass('mobile').removeClass('desktop');
                this.model.set('_isDesktop', false)
            }
        },

        postRender: function() {
            this.renderState();
            this.$('.scenario-audio-slider').imageready(_.bind(function() {
                this.setReadyStatus();
            }, this));
            this.setupScenarioAudio();
        },

        // Used to check if the scenario-audio should reset on revisit
        checkIfResetOnRevisit: function() {
            var isResetOnRevisit = this.model.get('_isResetOnRevisit');

            // If reset is enabled set defaults
            if (isResetOnRevisit) {
                this.model.reset(isResetOnRevisit);
                this.model.set({_stage: 0});

                _.each(this.model.get('_items'), function(item) {
                    item.visited = false;
                });
            }
        },

        setupScenarioAudio: function() {
            this.setDeviceSize();
            this.model.set('_marginDir', 'left');
            if (Adapt.config.get('_defaultDirection') == 'rtl') {
                this.model.set('_marginDir', 'right');
            }
            this.model.set('_itemCount', this.model.get('_items').length);

            this.model.set('_active', true);

            if (this.model.get('_stage')) {
                this.setStage(this.model.get('_stage'), true);
            } else {
                this.setStage(0, true);
            }
            this.calculateWidths();

            if (Adapt.device.screenSize !== 'large') {
                this.replaceInstructions();
            }
            this.setupEventListeners();
            
            // if hasNavigationInTextArea set margin left 
            var hasNavigationInTextArea = this.model.get('_hasNavigationInTextArea');
            if (hasNavigationInTextArea == true) {
                var indicatorWidth = this.$('.scenario-audio-indicators').width();
                var marginLeft = indicatorWidth / 2;
                
                this.$('.scenario-audio-indicators').css({
                    marginLeft: '-' + marginLeft + 'px'
                });
            }

            if (this.model.get('_reducedText') && this.model.get('_reducedText')._isEnabled) {
                this.replaceText(Adapt.audio.textSize);
            }
        },

        calculateWidths: function() {
            var slideWidth = this.$('.scenario-audio-slide-container').width();
            var slideCount = this.model.get('_itemCount');
            var marginRight = this.$('.scenario-audio-slider-graphic').css('margin-right');
            var extraMargin = marginRight === '' ? 0 : parseInt(marginRight);
            var fullSlideWidth = (slideWidth + extraMargin) * slideCount;
            var iconWidth = this.$('.scenario-audio-popup-open').outerWidth();

            this.$('.scenario-audio-slider-graphic').width(slideWidth);
            this.$('.scenario-audio-strapline-header').width(slideWidth);
            this.$('.scenario-audio-strapline-title').width(slideWidth);

            this.$('.scenario-audio-slider').width(fullSlideWidth);
            this.$('.scenario-audio-strapline-header-inner').width(fullSlideWidth);

            var stage = this.model.get('_stage');
            var margin = -(stage * slideWidth);

            this.$('.scenario-audio-slider').css(('margin-' + this.model.get('_marginDir')), margin);
            this.$('.scenario-audio-strapline-header-inner').css(('margin-' + this.model.get('_marginDir')), margin);

            this.model.set('_finalItemLeft', fullSlideWidth - slideWidth);
        },

        resizeControl: function() {
            this.setDeviceSize();
            this.replaceInstructions();
            this.calculateWidths();
            this.evaluateNavigation();
        },

        reRender: function() {
            this.resizeControl();
        },

        closeNotify: function() {
            this.evaluateCompletion()
        },

        replaceInstructions: function() {
            if (Adapt.device.screenSize === 'large') {
                this.$('.scenario-audio-instruction-inner').html(this.model.get('instruction')).a11y_text();
            } else if (this.model.get('mobileInstruction')) {
                this.$('.scenario-audio-instruction-inner').html(this.model.get('mobileInstruction')).a11y_text();
            }
        },

        moveSliderToIndex: function(itemIndex, animate, callback) {
            var extraMargin = parseInt(this.$('.scenario-audio-slider-graphic').css('margin-right'));
            var movementSize = this.$('.scenario-audio-slide-container').width() + extraMargin;
            var marginDir = {};
            if (animate && !Adapt.config.get('_disableAnimation')) {
                marginDir['margin-' + this.model.get('_marginDir')] = -(movementSize * itemIndex);
                this.$('.scenario-audio-slider').velocity("stop", true).velocity(marginDir);
                this.$('.scenario-audio-strapline-header-inner').velocity("stop", true).velocity(marginDir, {complete:callback});
            } else {
                marginDir['margin-' + this.model.get('_marginDir')] = -(movementSize * itemIndex);
                this.$('.scenario-audio-slider').css(marginDir);
                this.$('.scenario-audio-strapline-header-inner').css(marginDir);
                callback();
            }
        },

        setStage: function(stage, initial) {
            this.model.set('_stage', stage);

            if (this.model.get('_isDesktop')) {
                // Set the visited attribute for large screen devices
                var currentItem = this.getCurrentItem(stage);
                currentItem.visited = true;
            }

            this.$('.scenario-audio-progress:visible').removeClass('selected').eq(stage).addClass('selected');
            this.$('.scenario-audio-slider-graphic').children('.controls').a11y_cntrl_enabled(false);
            this.$('.scenario-audio-slider-graphic').eq(stage).children('.controls').a11y_cntrl_enabled(true);
            this.$('.scenario-audio-content-item').addClass('scenario-audio-hidden').a11y_on(false).eq(stage).removeClass('scenario-audio-hidden').a11y_on(true);
            this.$('.scenario-audio-strapline-title').a11y_cntrl_enabled(false).eq(stage).a11y_cntrl_enabled(true);

            this.evaluateNavigation();
            this.evaluateCompletion();

            this.moveSliderToIndex(stage, !initial, _.bind(function() {
                if (this.model.get('_isDesktop')) {
                    if (!initial) this.$('.scenario-audio-content-item').eq(stage).a11y_focus();
                } else {
                    if (!initial) this.$('.scenario-audio-popup-open').a11y_focus();
                }
            }, this));
        },

        constrainStage: function(stage) {
            if (stage > this.model.get('_items').length - 1) {
                stage = this.model.get('_items').length - 1;
            } else if (stage < 0) {
                stage = 0;
            }
            return stage;
        },

        constrainXPosition: function(previousLeft, newLeft, deltaX) {
            if (newLeft > 0 && deltaX > 0) {
                newLeft = previousLeft + (deltaX / (newLeft * 0.1));
            }
            var finalItemLeft = this.model.get('_finalItemLeft');
            if (newLeft < -finalItemLeft && deltaX < 0) {
                var distance = Math.abs(newLeft + finalItemLeft);
                newLeft = previousLeft + (deltaX / (distance * 0.1));
            }
            return newLeft;
        },

        evaluateNavigation: function() {
            var currentStage = this.model.get('_stage');
            var itemCount = this.model.get('_itemCount');
            if (currentStage == 0) {
                this.$('.scenario-audio-control-left').addClass('scenario-audio-hidden');

                if (itemCount > 1) {
                    this.$('.scenario-audio-control-right').removeClass('scenario-audio-hidden');
                }
            } else {
                this.$('.scenario-audio-control-left').removeClass('scenario-audio-hidden');

                if (currentStage == itemCount - 1) {
                    this.$('.scenario-audio-control-right').addClass('scenario-audio-hidden');
                } else {
                    this.$('.scenario-audio-control-right').removeClass('scenario-audio-hidden');
                }
            }

        },

        getNearestItemIndex: function() {
            var currentPosition = parseInt(this.$('.scenario-audio-slider').css('margin-left'));
            var graphicWidth = this.$('.scenario-audio-slider-graphic').width();
            var absolutePosition = currentPosition / graphicWidth;
            var stage = this.model.get('_stage');
            var relativePosition = stage - Math.abs(absolutePosition);

            if (relativePosition < -0.3) {
                stage++;
            } else if (relativePosition > 0.3) {
                stage--;
            }

            return this.constrainStage(stage);
        },

        getCurrentItem: function(index) {
            return this.model.get('_items')[index];
        },

        getVisitedItems: function() {
            return _.filter(this.model.get('_items'), function(item) {
                return item.visited;
            });
        },

        evaluateCompletion: function() {
            if (this.getVisitedItems().length === this.model.get('_items').length) {
                this.trigger('allItems');
            } 
        },

        moveElement: function($element, deltaX) {
            var previousLeft = parseInt($element.css('margin-left'));
            var newLeft = previousLeft + deltaX;

            newLeft = this.constrainXPosition(previousLeft, newLeft, deltaX);
            $element.css(('margin-' + this.model.get('_marginDir')), newLeft + 'px');
        },

        openPopup: function(event) {
            event.preventDefault();
            var currentItem = this.getCurrentItem(this.model.get('_stage'));

            // Set popup text to default full size
            var popupObject_title = currentItem.title;
            var popupObject_body = currentItem.body;

            // If reduced text is enabled and selected
            if (this.model.get('_reducedText') && this.model.get('_reducedText')._isEnabled && Adapt.audio.textSize == 1) {
                popupObject_title = currentItem.titleReduced;
                popupObject_body = currentItem.bodyReduced;
            }

            var popupObject = {
                title: popupObject_title,
                body: popupObject_body
            };

            // Set the visited attribute for small and medium screen devices
            currentItem.visited = true;

            Adapt.trigger('notify:popup', popupObject);

            ///// Audio /////
            if (this.model.has('_audio') && this.model.get('_audio')._isEnabled && Adapt.audio.audioClip[this.model.get('_audio')._channel].status==1) {
                // Trigger audio
                Adapt.trigger('audio:playAudio', currentItem._audio.src, this.model.get('_id'), this.model.get('_audio')._channel);
            }
            ///// End of Audio /////
        },

        onNavigationClicked: function(event) {
            event.preventDefault();

            if (!this.model.get('_active')) return;

            var stage = this.model.get('_stage');
            var numberOfItems = this.model.get('_itemCount');

            if ($(event.currentTarget).hasClass('scenario-audio-control-right')) {
                stage++;
            } else if ($(event.currentTarget).hasClass('scenario-audio-control-left')) {
                stage--;
            }
            stage = (stage + numberOfItems) % numberOfItems;
            this.setStage(stage);

            ///// Audio /////
            if (Adapt.device.screenSize === 'large') {
                var currentItem = this.getCurrentItem(stage);

                if (this.model.has('_audio') && this.model.get('_audio')._isEnabled && Adapt.audio.audioClip[this.model.get('_audio')._channel].status==1) {
                    // Trigger audio
                    Adapt.trigger('audio:playAudio', currentItem._audio.src, this.model.get('_id'), this.model.get('_audio')._channel);
                }
            }
            ///// End of Audio /////
        },
        
        onProgressClicked: function(event) {
            event.preventDefault();
            var clickedIndex = $(event.target).index();
            this.setStage(clickedIndex);
        },

        inview: function(event, visible, visiblePartX, visiblePartY) {
            if (visible) {
                if (visiblePartY === 'top') {
                    this._isVisibleTop = true;
                } else if (visiblePartY === 'bottom') {
                    this._isVisibleBottom = true;
                } else {
                    this._isVisibleTop = true;
                    this._isVisibleBottom = true;
                }

                if (this._isVisibleTop && this._isVisibleBottom) {
                    this.$('.component-inner').off('inview');
                    this.setCompletionStatus();
                }
            }
        },

        onCompletion: function() {
            this.setCompletionStatus();
            if (this.completionEvent && this.completionEvent != 'inview') {
                this.off(this.completionEvent, this);
            }
        },

        setupEventListeners: function() {
            this.completionEvent = (!this.model.get('_setCompletionOn')) ? 'allItems' : this.model.get('_setCompletionOn');
            if (this.completionEvent !== 'inview') {
                this.on(this.completionEvent, _.bind(this.onCompletion, this));
            } else {
                this.$('.component-widget').on('inview', _.bind(this.inview, this));
            }
        },

        // Reduced text
        replaceText: function(value) {
            // If enabled
            if (this.model.get('_reducedText') && this.model.get('_reducedText')._isEnabled) {
                // Change component title and body
                if(value == 0) {
                    this.$('.component-title-inner').html(this.model.get('displayTitle')).a11y_text();
                    this.$('.component-body-inner').html(this.model.get('body')).a11y_text();
                } else {
                    this.$('.component-title-inner').html(this.model.get('displayTitleReduced')).a11y_text();
                    this.$('.component-body-inner').html(this.model.get('bodyReduced')).a11y_text();
                }
                // Change each items title and body
                for (var i = 0; i < this.model.get('_items').length; i++) {
                    if(value == 0) {
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

    Adapt.register('scenario-audio', ScenarioAudio);

    return ScenarioAudio;

});
