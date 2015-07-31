(function($, Backbone) {
  /**
   * View for an interactive list.
   * To use pass the following options:
   * - template (JST/Underscore template for each line item)
   * - collection: Optional Backbone collection
   * - url: Url for collection
   * - limit: Optional limit of items to display
   * - filter: Optional filter method that will be applied to the collection before creating the list
   * - click: Optional click callback for each item. receives 2 args, model and index
   * Instantiate and attach render() to any event of your choosing
   */
  Backbone.InteractiveList = Backbone.View.extend({
    initialize: function(options) {
      this.options = options;
      this.template = options.template;
      this.timer = null;
      if (!this.collection) {
        this.collection = new Backbone.Collection();
      }
      this.collection.url = options.url;
    },

    render: function(allowServer) {
      var view = this,
          click = this.options.click,
          filter = this.options.filter,
          limit = this.options.limit;
      this.refresh(function() {
        // append items to el
        view.$el.empty();
        if (this.collection.length==0) {
          this.trigger('not-found');
        } else {
          var lis = document.createDocumentFragment();
          _.each(this.collection.filter(function(model) {
            return !_.isFunction(filter) || filter.call(view, model);
          }), function(model, i) {
            if (!limit || i < limit) {
              var $li = $(view.template(model.attributes));
              if (_.isFunction(click)) {
                $li.on('mousedown', function() {
                  click.call(view, model, i);
                }).on('mouseover', function() {
                  $(this).siblings().removeClass('selected');
                  $(this).addClass('selected');
                });
              }
              lis.appendChild($li[0]);
            }
          });
          view.$el.append(lis);
        }
        this.$el.show();
        this.trigger('render');
      }, allowServer);
      return this;
    },

    refresh: function(callback, allowServer) {
      var view = this;
      clearTimeout(this.timer);

      if (this.collection.every(function(model) { // no matches in current collection
        return !_.isFunction(this.options.filter) || !this.options.filter.call(view, model);
      }, this) && (allowServer && this.collection.url && (!this.lastUrl || this.lastUrl!=_.result(this.collection, 'url')))) { // try server if URL changed
        this.timer = setTimeout(function() {
          // fetch collection from server and render it
          view.collection.fetch({
            success: function() {
              view.lastUrl = _.result(view.collection, 'url');
              callback.call(view);
            }
          });
        }, this.options.delay);
      } else {
        callback.call(view);
      }
    }
  });

  /**
   * View for an autocomplete.
   * To use pass the same options as InteractiveList plus:
   * - value: Function that returns the value to be used as the input's value when the model is selected. May be a function that accepts a
       model as its argument or a string naming a model method.
   * - results: Optional results element. If not passed, one will be created and appended to body.
   */
  Backbone.AutocompleteList = Backbone.View.extend({
    initialize: function(options) {
      this.options = options;
      var view = this;
      this.term = this.$el.val();
      if (!this.collection) {
        this.collection = new Backbone.Collection();
      }
      this.collection.url = options.url;
      this.shortList = this.collection ? _.clone(this.collection.models) : [];

      // if no filter method passed use standard case-insensitive contains using the input value
      if (this.options.filter===undefined) {
        this.options.filter = function(model) {
          return view.options.value.call(model, model).toLowerCase().indexOf(view.$el.val().toLowerCase())!=-1;
        };
      }

      this.options.click = this.options.click || _.bind(function(model) {
        this.results.hide();
        this.$selected().removeClass('selected');
        this.$el.val(options.value.call(model, model));
        this.term = this.$el.val();
        this.$el.focus();
        this.trigger('selected', model);
      }, this);

      // create the results element if not passed as an option
      this.results = options.results || $('<div>', { 'class': 'autocomplete-results' }).css({
        position: 'absolute',
        zIndex: 1,
        left: this.$el.offset().left,
        top: this.$el.offset().top + this.$el.outerHeight(),
        width: this.$el.outerWidth(),
      }).appendTo($('body'));
      this.resultsView = new Backbone.InteractiveList(_.defaults({ el: this.results }, this.options)).on('render', this.next, this);
    },

    events: {
      keyup: 'keyup',
      keydown: 'keydown',
      blur: 'blur'
    },

    $selected: function() {
      return this.resultsView.$('.selected');
    },
    
    keyup: function() {
      var resultsView = this.resultsView;
      if (this.term != this.$el.val()) {
        this.term = this.$el.val();
        this.collection.reset(this.shortList);
        if (this.term.length) {
          resultsView.render(!this.options.minLength || this.term.length >= this.options.minLength);
        } else {
          this.results.hide();
        }
      }
      return true;
    },

    keydown: function(e) {
      // Esc
      if (e.keyCode == 27) {
        this.blur();
        return false;
      }
      // Enter
      if (e.keyCode == 13 || e.keyCode == 9) {
        // if an item is selected, act like it was clicked
        if (this.$selected().length > 0) {
          this.$selected().mousedown();
          return false;
        }
      }
      // Down
      if (e.keyCode == 40) {
        this.next();
        return false;
      }
      // Up
      if (e.keyCode == 38) {
        this.previous();
        return false;
      }
      return true;
    },

    next: function() {
      var next = this.$selected().removeClass('selected').next();
      if (next.length==0) { next = this.results.children().first(); }
      next.addClass('selected');
      this.scroll();
    },

    previous: function() {
      var prev = this.$selected().removeClass('selected').prev();
      if (prev.length==0) { prev = this.results.children().last(); }
      prev.addClass('selected');
      this.scroll();
    },

    blur: function(e) {
      var view = this;
      view.results.hide();
    },

    // scroll till selected element is in view
    scroll: function() {
      if (this.$selected().length==1) {
        if (this.$selected().position().top + this.$selected().height() > this.results.height()) {
          this.results.scrollTop(this.results.scrollTop() + this.$selected().position().top + this.$selected().height() - this.results.height());
        } else if (this.$selected().position().top < 0) {
          this.results.scrollTop(this.results.scrollTop() + this.$selected().position().top);
        }
      }
    },
  });
}(window.jQuery, window.Backbone));
