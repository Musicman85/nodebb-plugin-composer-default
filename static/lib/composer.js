'use strict';

/* globals define, socket, app, config, ajaxify, utils, templates, bootbox */

define('composer', [
    'taskbar',
    'translator',
    'composer/controls',
    'composer/uploads',
    'composer/formatting',
    'composer/drafts',
    'composer/tags',
    'composer/categoryList',
    'composer/preview',
    'composer/resize',
    'composer/autocomplete'
], function (taskbar, translator, controls, uploads, formatting, drafts, tags, categoryList, preview, resize, autocomplete) {
    var composer = {
        active: undefined,
        posts: {},
        bsEnvironment: undefined,
        formatting: undefined
    };

    $(window).off('resize', onWindowResize).on('resize', onWindowResize);

    $(window).on('action:composer.topics.post', function (ev, data) {
        localStorage.removeItem('category:' + data.data.cid + ':bookmark');
        localStorage.removeItem('category:' + data.data.cid + ':bookmark:clicked');
    });

    $(window).on('popstate', function () {
        var env = utils.findBootstrapEnvironment();

        if (composer.active && (env === 'xs' || env === 'sm')) {
            if (!composer.posts[composer.active].modified) {
                discard(composer.active);
                return;
            }

            translator.translate('[[modules:composer.discard]]', function (translated) {
                bootbox.confirm(translated, function (confirm) {
                    if (confirm) {
                        discard(composer.active);
                    }
                });
            });
        }
    });

    function removeComposerHistory() {
        var env = utils.findBootstrapEnvironment();
        if (ajaxify.data.template.compose === true || env === 'xs' || env === 'sm') {
            history.back();
        }
    }

    function onWindowResize() {
        if (composer.active !== undefined) {
            var env = utils.findBootstrapEnvironment();

            resize.reposition($('#cmp-uuid-' + composer.active));

            if ((env === 'md' || env === 'lg') && ajaxify.currentPage.indexOf('compose') === 0) {
                /**
                 *  If this conditional is met, we're no longer in mobile/tablet
                 *  resolution but we've somehow managed to have a mobile
                 *  composer load, so let's go back to the topic
                 */
                history.back();
            }
        }
        composer.bsEnvironment = utils.findBootstrapEnvironment();
    }

    function alreadyOpen(post) {
        // If a composer for the same cid/tid/pid is already open, return the uuid, else return bool false
        var type, id;

        if (post.hasOwnProperty('cid')) {
            type = 'cid';
        } else if (post.hasOwnProperty('tid')) {
            type = 'tid';
        } else if (post.hasOwnProperty('pid')) {
            type = 'pid';
        }

        id = post[type];

        // Find a match
        for (var uuid in composer.posts) {
            if (composer.posts[uuid].hasOwnProperty(type) && id === composer.posts[uuid][type]) {
                return uuid;
            }
        }

        // No matches...
        return false;
    }

    function push(post) {
        var uuid = utils.generateUUID(),
            existingUUID = alreadyOpen(post);

        if (existingUUID) {
            taskbar.updateActive(existingUUID);
            return composer.load(existingUUID);
        }

        translator.translate('[[topic:composer.new_topic]]', function (newTopicStr) {
            taskbar.push('composer', uuid, {
                title: post.title ? post.title : newTopicStr
            });
        });

        // Construct a save_id
        if (0 !== parseInt(app.user.uid, 10)) {
            if (post.hasOwnProperty('cid')) {
                post.save_id = ['composer', app.user.uid, 'cid', post.cid].join(':');
            } else if (post.hasOwnProperty('tid')) {
                post.save_id = ['composer', app.user.uid, 'tid', post.tid].join(':');
            } else if (post.hasOwnProperty('pid')) {
                post.save_id = ['composer', app.user.uid, 'pid', post.pid].join(':');
            }
        }

        composer.posts[uuid] = post;
        composer.load(uuid);
    }

    function composerAlert(post_uuid, message) {
        $('#cmp-uuid-' + post_uuid).find('.composer-submit').removeAttr('disabled');
        app.alert({
            type: 'danger',
            timeout: 3000,
            title: '',
            message: message,
            alert_id: 'post_error'
        });
    }

    composer.findByTid = function (tid) {
        // Iterates through the initialised composers and returns the uuid of the matching composer
        for (var uuid in composer.posts) {
            if (composer.posts.hasOwnProperty(uuid) && composer.posts[uuid].hasOwnProperty('tid') && parseInt(composer.posts[uuid].tid, 10) === parseInt(tid, 10)) {
                return uuid;
            }
        }

        return null;
    };

    composer.addButton = function (iconClass, onClick, title) {
        formatting.addButton(iconClass, onClick, title);
    };

    composer.newTopic = function (data) {
        push({
            action: 'topics.post',
            cid: data.cid,
            title: data.title || '',
            body: data.body || '',
            modified: false,
            isMain: true
        });
    };

    composer.addQuote = function (tid, topicSlug, postIndex, pid, title, username, text, uuid) {
        uuid = uuid || composer.active;

        var escapedTitle = (title || '').replace(/([\\`*_{}\[\]()#+\-.!])/g, '\\$1').replace(/\[/g, '&#91;').replace(/\]/g, '&#93;').replace(/%/g, '&#37;').replace(/,/g, '&#44;');

        if (text) {
            text = '> ' + text.replace(/\n/g, '\n> ') + '\n\n';
        }

        if (uuid === undefined) {
            if (title && topicSlug && postIndex) {
                var link = '[' + escapedTitle + '](/post/' + pid + ')';
                composer.newReply(tid, pid, title, '[[modules:composer.user_said_in, ' + username + ', ' + link + ']]\n' + text);
            } else {
                composer.newReply(tid, pid, title, '[[modules:composer.user_said, ' + username + ']]\n' + text);
            }
            return;
        } else if (uuid !== composer.active) {
            // If the composer is not currently active, activate it
            composer.load(uuid);
        }

        var postContainer = $('#cmp-uuid-' + uuid);
        var bodyEl = postContainer.find('textarea');
        var prevText = bodyEl.val();
        if (title && topicSlug && postIndex) {
            var link = '[' + escapedTitle + '](/topic/' + topicSlug + '/' + (parseInt(postIndex, 10) + 1) + ')';
            translator.translate('[[modules:composer.user_said_in, ' + username + ', ' + link + ']]\n', config.defaultLang, onTranslated);
        } else {
            translator.translate('[[modules:composer.user_said, ' + username + ']]\n', config.defaultLang, onTranslated);
        }

        function onTranslated(translated) {
            composer.posts[uuid].body = (prevText.length ? prevText + '\n\n' : '') + translated + text;
            bodyEl.val(composer.posts[uuid].body);
            focusElements(postContainer);
            preview.render(postContainer);
        }
    };

    composer.newReply = function (tid, pid, title, text) {
        translator.translate(text, config.defaultLang, function (translated) {
            push({
                action: 'posts.reply',
                tid: tid,
                toPid: pid,
                title: title,
                body: translated,
                modified: false,
                isMain: false
            });
        });
    };

    composer.editPost = function (pid) {
        socket.emit('plugins.composer.push', pid, function (err, threadData) {
            if (err) {
                return app.alertError(err.message);
            }

            push({
                action: 'posts.edit',
                pid: pid,
                uid: threadData.uid,
                handle: threadData.handle,
                title: threadData.title,
                body: threadData.body,
                modified: false,
                isMain: threadData.isMain,
                topic_thumb: threadData.topic_thumb,
                tags: threadData.tags
            });
        });
    };

    composer.load = function (post_uuid) {
        var postContainer = $('#cmp-uuid-' + post_uuid);
        if (postContainer.length) {
            activate(post_uuid);
            resize.reposition(postContainer);
            focusElements(postContainer);
        } else {
            if (composer.formatting) {
                createNewComposer(post_uuid);
            } else {
                socket.emit('plugins.composer.getFormattingOptions', function (err, options) {
                    composer.formatting = options;
                    createNewComposer(post_uuid);
                });
            }
        }
    };

    composer.enhance = function (postContainer, post_uuid, postData) {
        /*
            This method enhances a composer container with client-side sugar (preview, etc)
            Everything in here also applies to the /compose route
        */

        if (!post_uuid && !postData) {
            post_uuid = utils.generateUUID();
            composer.posts[post_uuid] = postData = ajaxify.data;
            postContainer.attr('id', 'cmp-uuid-' + post_uuid);
        }

        var bodyEl = postContainer.find('textarea'),
            draft = drafts.getDraft(postData.save_id),
            submitBtn = postContainer.find('.composer-submit');

        formatting.addHandler(postContainer);
        formatting.addComposerButtons();
        preview.handleToggler(postContainer);

        if (config.hasImageUploadPlugin) {
            postContainer.find('.img-upload-btn').removeClass('hide');
            postContainer.find('#files.lt-ie9').removeClass('hide');
        }

        if (config.allowFileUploads) {
            postContainer.find('.file-upload-btn').removeClass('hide');
            postContainer.find('#files.lt-ie9').removeClass('hide');
        }

        if (config.allowFileUploads || config.hasImageUploadPlugin || config.allowTopicsThumbnail) {
            uploads.initialize(post_uuid, ajaxify.data.cid);
        }

        if (config.allowTopicsThumbnail && postData.isMain) {
            uploads.toggleThumbEls(postContainer, composer.posts[post_uuid].topic_thumb || '');
        }

        autocomplete.init(postContainer);

        postContainer.on('change', 'input, textarea', function () {
            composer.posts[post_uuid].modified = true;
        });

        submitBtn.on('click', function () {
            var action = $(this).attr('data-action');

            switch (action) {
                case 'post-lock':
                    $(this).attr('disabled', true);
                    post(post_uuid, {
                        lock: true
                    });
                    break;

                case 'post': // intentional fall-through
                default:
                    $(this).attr('disabled', true);
                    post(post_uuid);
                    break;
            }
        });

        postContainer.on('click', 'a[data-switch-action]', function () {
            var action = $(this).attr('data-switch-action'),
                label = $(this).html();

            submitBtn.attr('data-action', action).html(label);
        });

        postContainer.find('.composer-discard').on('click', function (e) {
            e.preventDefault();

            if (!composer.posts[post_uuid].modified) {
                removeComposerHistory();
                discard(post_uuid);
                return;
            }
            var btn = $(this).prop('disabled', true);
            translator.translate('[[modules:composer.discard]]', function (translated) {
                bootbox.confirm(translated, function (confirm) {
                    if (confirm) {
                        removeComposerHistory();
                        discard(post_uuid);
                    }
                    btn.prop('disabled', false);
                });
            });
        });

        bodyEl.on('input propertychange', function () {
            preview.render(postContainer);
        });

        bodyEl.on('scroll', function () {
            preview.matchScroll(postContainer);
        });

        preview.render(postContainer, function () {
            preview.matchScroll(postContainer);
        });

        bodyEl.val(draft ? draft : postData.body);
        drafts.init(postContainer, postData);

        categoryList.init(postContainer, composer.posts[post_uuid]);
        handleHelp(postContainer);

        focusElements(postContainer);

        $(window).trigger('action:composer.enhanced');
    };

    function createNewComposer(post_uuid) {
        var postData = composer.posts[post_uuid];

        var allowTopicsThumbnail = config.allowTopicsThumbnail && postData.isMain,
            isTopic = postData ? postData.hasOwnProperty('cid') : false,
            isMain = postData ? !!postData.isMain : false,
            isEditing = postData ? !!postData.pid : false,
            isGuestPost = postData ? parseInt(postData.uid, 10) === 0 : false;

        composer.bsEnvironment = utils.findBootstrapEnvironment();

        // see
        // https://github.com/NodeBB/NodeBB/issues/2994 and
        // https://github.com/NodeBB/NodeBB/issues/1951
        // remove when 1951 is resolved

        var title = postData.title.replace(/%/g, '&#37;').replace(/,/g, '&#44;');

        var data = {
            title: title,
            mobile: composer.bsEnvironment === 'xs' || composer.bsEnvironment === 'sm',
            resizable: true,
            allowTopicsThumbnail: allowTopicsThumbnail,
            isTopicOrMain: isTopic || isMain,
            minimumTagLength: config.minimumTagLength,
            maximumTagLength: config.maximumTagLength,
            isTopic: isTopic,
            isEditing: isEditing,
            showHandleInput: config.allowGuestHandles && (app.user.uid === 0 || (isEditing && isGuestPost && app.user.isAdmin)),
            handle: postData ? postData.handle || '' : undefined,
            formatting: composer.formatting
        };

        if (data.mobile) {
            var path = 'compose?p=' + window.location.pathname,
                returnPath = window.location.pathname.slice(1);

            // Add in return path to be caught by ajaxify when post is completed, or if back is pressed
            window.history.replaceState({
                url: null,
                returnPath: returnPath
            }, returnPath, config.relative_path + '/' + returnPath);

            // Update address bar in case f5 is pressed
            window.history.pushState({
                url: path
            }, path, config.relative_path + '/' + path);
            renderComposer();
        } else {
            renderComposer();
        }

        function renderComposer() {
            parseAndTranslate('composer', data, function (composerTemplate) {
                if ($('#cmp-uuid-' + post_uuid).length) {
                    return;
                }
                composerTemplate = $(composerTemplate);

                composerTemplate.attr('id', 'cmp-uuid-' + post_uuid);

                $(document.body).append(composerTemplate);

                var postContainer = $(composerTemplate[0]);

                composer.enhance(postContainer, post_uuid, postData);
                /*
                    Everything after this line is applied to the resizable composer only
                    Want something done to both resizable composer and the one in /compose?
                    Put it in composer.enhance().

                    Eventually, stuff after this line should be moved into composer.enhance().
                */

                tags.init(postContainer, composer.posts[post_uuid]);

                activate(post_uuid);

                postContainer.on('click', function () {


                    if (!taskbar.isActive(post_uuid)) {
                        taskbar.updateActive(post_uuid);
                    }
                });

                resize.handleResize(postContainer);


                if (composer.bsEnvironment === 'xs' || composer.bsEnvironment === 'sm') {
                    var submitBtns = postContainer.find('.composer-submit'),
                        mobileSubmitBtn = postContainer.find('.mobile-navbar .composer-submit'),
                        textareaEl = postContainer.find('.write'),
                        idx = textareaEl.attr('tabindex');

                    submitBtns.removeAttr('tabindex');
                    mobileSubmitBtn.attr('tabindex', parseInt(idx, 10) + 1);

                    //added postcontainer because the click event was not on all containers
                   postContainer.find('.category-name-container').on('click', function () {
                        postContainer.find('.category-selector').toggleClass('open');

                    });


                }

                $(window).trigger('action:composer.loaded', {
                    post_uuid: post_uuid,
                    composerData: composer.posts[post_uuid]
                });

                resize.reposition(postContainer);
                focusElements(postContainer);

                //BEGIN pg-mod



                $('.pg-minimize').each(function () {

                    if (!$(this).attr("data-uuid")) {
                        $(this).attr("data-uuid", post_uuid);

                        $(this).on('click', function () {

                            var actualComposeWindow = $('#cmp-uuid-' + $(this).attr('data-uuid'));
                            var env = utils.findBootstrapEnvironment();
                            var extraScrollHeight = 540;


                            // Set correct description text in header which is displayed when minimized
                            var headerText = actualComposeWindow.find('.category-list-container option');
                            headerText.each(function () {
                                if ($(this)[0].selected) {
                                    actualComposeWindow.find('#pg-category')[0].innerText = $(this).text();
                                }
                            });

                            //The window could have fullscreen if minimize/expand button is clicked
                            if (!actualComposeWindow.hasClass('minimized') && actualComposeWindow.hasClass('fullscreen')) {
                                actualComposeWindow.toggleClass('fullscreen');
                            }

                            if (!$('.composer').hasClass('fullscreen') && $("#search-overlay").hasClass('active')) {
                                $("#search-overlay").toggleClass("active");
                            }

                            if (actualComposeWindow.hasClass('minimized')) {

                                //the composer is closed when clicked

                                actualComposeWindow.addClass('open');

                                if (env === 'md' || env === 'lg') {
                                    //When desktop, set extra scroll to be able to scroll the complete page when composing
                                    $('body').css({
                                        'margin-bottom': extraScrollHeight
                                    });

                                    //align actualcompose window to the left when open if it doesn't fit in window
                                    var widthOpen = 768;

                                    var left = 'auto';
                                    if (actualComposeWindow.position().left + actualComposeWindow.width() < widthOpen) {
                                        left = 0;
                                    }

                                    actualComposeWindow.css({
                                        'width': widthOpen + 'px',
                                        'left': left,
                                        'top': 'auto'
                                    });
                                } else {
                                    //mobile
                                    actualComposeWindow.css({
                                        'width': '100%',
                                        'height': '100%',
                                        'left': 0,
                                        'right': 0,
                                        'top': 'auto'
                                    });
                                }
                                actualComposeWindow.removeClass('minimized');


                            } else {
                                // the composer is open when clicked
                                //Reset the body scroll margin'
                                if (actualComposeWindow.hasClass('open')) {
                                    actualComposeWindow.removeClass('open');
                                }
                                $('body').css({
                                    'margin-bottom': 0
                                });
                                var composeCount = $('.composer').length;

                                var composerMargin = 16;
                                var composerMinWidth = 300;
                                var composerMaxWidth = 350;
                                var minimizedHeight = 40;

                                if (env === 'sm' || env === 'xs') {
                                    composerMargin = 10;
                                    composerMinWidth = 120;
                                    composerMaxWidth = 300;
                                    minimizedHeight = 50;
                                }

                                var i = 0;

                                $('.composer').each(function () {

                                    //Place all composer windows properly
                                    var composerDimensions = getComposerDimensions(composeCount, composerMargin, composerMinWidth, composerMaxWidth, i);

                                    if (env === 'md' || env === 'lg') {

                                        if (!$(this).hasClass('open') && !$(this).hasClass('minimized')) {

                                            $(this).css({
                                                'width': composerDimensions.width + 'px',
                                                'right': composerDimensions.right + 'px',
                                                'left': 'auto'
                                            });
                                        }
                  
                                    } else {
                                        //On mobile all on mobile
                                        $(this).css({
                                            'width': composerDimensions.width + 'px',
                                            'right': composerDimensions.right + 'px',
                                            'left': 'auto',
                                            'height': minimizedHeight,
                                            'top': 'auto'
                                        });
                                    }

                                    i++;

                                });
                                actualComposeWindow.addClass('minimized');

                            }

                        });

                    }
                });


                $('.pg-fullscreen').each(function () {

                    //uggly way to make a check that only one click listnener is set
                    if (!$(this).attr("fullscreen-tag")) {
                        $(this).attr("fullscreen-tag", 'yes');

                        $(this).on('click', function () {
                            var actualComposeWindow = $(this).parent().parent();
                            fullScreenToggle(actualComposeWindow);
                        });

                    }
                });

                //change depth of composer elements when clinking
                $('.composer').click(function () {

                    var zDiff = 0;
                    var clickedElement = $(this);
                    var changeZdirection = false;

                    $('.composer').each(function () {

                        if ($(this) === clickedElement) {
                            changeZdirection = true;
                            zDiff = 0;
                        }

                        if (changeZdirection) {
                            $(this).css('z-index', 10000 - zDiff);
                        } else {
                            $(this).css('z-index', 9990 + zDiff);
                        }

                        zDiff++;
                    });
                    $(this).css('z-index', '10000');

                });


                //END pg-mod

            });

        }
    }

    //BEGIN PG-functions
    function getComposerDimensions(composeCount, composerMargin, composerMinWidth, composerMaxWidth, i) {
        var composerWidth = (window.innerWidth - composerMargin - composeCount * composerMargin) / composeCount;
        var paddingWhenNotFit = 0;

        if (composerWidth < composerMinWidth) {
            composerWidth = composerMinWidth;
        }
        if (composerWidth > composerMaxWidth) {
            composerWidth = composerMaxWidth;
        }

        var totalWidth = composerMargin + (composerWidth + composerMargin) * composeCount;

        if (totalWidth > window.innerWidth) {
            paddingWhenNotFit = (totalWidth - window.innerWidth) / (composeCount - 1);
        }

        var right = composerMargin + i * (composerWidth + composerMargin) - i * paddingWhenNotFit;
        return {
            right: right,
            width: composerWidth
        };
    }

    function fullScreenToggle(actualComposeWindow) {
        if (actualComposeWindow.hasClass('fullscreen')) {
            //Leaving full screen
            var left = 'auto';
            var minWidth = 350;
            var widthOpen = 768;

            var padding = 16;

            var composeCount = $('.composer').length;

            var calculatedRightPos = composeCount * (minWidth + padding);

            if (calculatedRightPos + widthOpen > window.innerWidth) {
                left = 0;
            }

            actualComposeWindow.css({
                'height': '70%',
                'width': '768px',
                'left': left,
            });

        } else {
            //entering full screen
            //The window could not be minimized when fullscreen button is clicked

            if (actualComposeWindow.hasClass('minimized')) {
                //Entering full screen from minimized
                actualComposeWindow.toggleClass('minimized');

            }


        }
        $("#search-overlay").toggleClass("active");
        actualComposeWindow.toggleClass('fullscreen');

        if (actualComposeWindow.hasClass('fullscreen')) {

            actualComposeWindow.find('.write-preview-container').css({
                // 'height': actualComposeWindow.find('.composer-container').height()-40 + 'px',

            });
        }
        //check if any composer has fullscreen
        if ($('.composer').hasClass('fullscreen') && !$('#search-overlay').hasClass('active')) {
            $('#search-overlay').toggleClass('active');
        }

    }
    //END PG-functions

    function parseAndTranslate(template, data, callback) {
        templates.parse(template, data, function (composerTemplate) {
            translator.translate(composerTemplate, callback);
        });
    }

    function handleHelp(postContainer) {
        var helpBtn = postContainer.find('.help');
        socket.emit('plugins.composer.renderHelp', function (err, html) {
            if (!err && html && html.length > 0) {
                helpBtn.removeClass('hidden');
                helpBtn.on('click', function () {
                    bootbox.alert(html);
                });
            }
        });
    }

    function activate(post_uuid) {
        if (composer.active && composer.active !== post_uuid) {
            composer.minimize(composer.active);
        }

        composer.active = post_uuid;
    }

    function focusElements(postContainer) {
        var title = postContainer.find('input.title');

        if (postContainer.hasClass('fullscreen')) {
            postContainer.toggleClass('fullscreen');
        }
        if (postContainer.hasClass('minimized')) {
            postContainer.toggleClass('minimized');

        }
        var env = utils.findBootstrapEnvironment();

        if (env === 'md' || env === 'lg') {
            $('body').css({
                'margin-bottom': postContainer.outerHeight()
            });
        }

        //end PG-mod
        if (title.length) {
            title.focus();
        } else {
            postContainer.find('textarea').focus().putCursorAtEnd();
        }
    }

    function post(post_uuid, options) {
        var postData = composer.posts[post_uuid];
        var postContainer = $('#cmp-uuid-' + post_uuid);
        var handleEl = postContainer.find('.handle');
        var titleEl = postContainer.find('.title');
        var bodyEl = postContainer.find('textarea');
        var categoryEl = postContainer.find('.category-list');
        var thumbEl = postContainer.find('input#topic-thumb-url');
        var onComposeRoute = postData.hasOwnProperty('template') && postData.template.compose === true;

        options = options || {};

        titleEl.val(titleEl.val().trim());
        bodyEl.val(bodyEl.val().rtrim());
        if (thumbEl.length) {
            thumbEl.val(thumbEl.val().trim());
        }

        var checkTitle = (postData.hasOwnProperty('cid') || parseInt(postData.pid, 10)) && postContainer.find('input.title').length;

        if (uploads.inProgress[post_uuid] && uploads.inProgress[post_uuid].length) {
            return composerAlert(post_uuid, '[[error:still-uploading]]');
        } else if (checkTitle && titleEl.val().length < parseInt(config.minimumTitleLength, 10)) {
            return composerAlert(post_uuid, '[[error:title-too-short, ' + config.minimumTitleLength + ']]');
        } else if (checkTitle && titleEl.val().length > parseInt(config.maximumTitleLength, 10)) {
            return composerAlert(post_uuid, '[[error:title-too-long, ' + config.maximumTitleLength + ']]');
        } else if (checkTitle && tags.getTags(post_uuid) && tags.getTags(post_uuid).length < parseInt(config.minimumTagsPerTopic, 10)) {
            return composerAlert(post_uuid, '[[error:not-enough-tags, ' + config.minimumTagsPerTopic + ']]');
        } else if (bodyEl.val().length < parseInt(config.minimumPostLength, 10)) {
            return composerAlert(post_uuid, '[[error:content-too-short, ' + config.minimumPostLength + ']]');
        } else if (bodyEl.val().length > parseInt(config.maximumPostLength, 10)) {
            return composerAlert(post_uuid, '[[error:content-too-long, ' + config.maximumPostLength + ']]');
        }

        var composerData = {};
        var action = postData.action;

        if (action === 'topics.post') {
            composerData = {
                handle: handleEl ? handleEl.val() : undefined,
                title: titleEl.val(),
                content: bodyEl.val(),
                thumb: thumbEl.val() || '',
                cid: categoryEl.val(),
                tags: tags.getTags(post_uuid),
                lock: options.lock || false
            };
        } else if (action === 'posts.reply') {
            composerData = {
                tid: postData.tid,
                handle: handleEl ? handleEl.val() : undefined,
                content: bodyEl.val(),
                toPid: postData.toPid,
                lock: options.lock || false
            };
        } else if (action === 'posts.edit') {
            composerData = {
                pid: postData.pid,
                handle: handleEl ? handleEl.val() : undefined,
                content: bodyEl.val(),
                title: titleEl.val(),
                thumb: thumbEl.val() || '',
                tags: tags.getTags(post_uuid)
            };
        }

        socket.emit(action, composerData, function (err, data) {
            postContainer.find('.composer-submit').removeAttr('disabled');
            if (err) {
                if (err.message === '[[error:email-not-confirmed]]') {
                    return app.showEmailConfirmWarning(err);
                }

                return app.alertError(err.message);
            }

            discard(post_uuid);
            drafts.removeDraft(postData.save_id);

            if (action === 'topics.post') {
                ajaxify.go('topic/' + data.slug, undefined, (onComposeRoute || composer.bsEnvironment === 'xs' || composer.bsEnvironment === 'sm') ? true : false);
            } else if (action === 'posts.reply') {
                if (onComposeRoute || composer.bsEnvironment === 'xs' || composer.bsEnvironment === 'sm') {
                    window.history.back();
                } else if (ajaxify.data.template.topic) {
                    if (postData.tid !== ajaxify.data.tid) {
                        ajaxify.go('post/' + data.pid);
                    }
                    // else, we're in the same topic, no nav required
                } else {
                    ajaxify.go('post/' + data.pid);
                }
            } else {
                removeComposerHistory();
            }

            $(window).trigger('action:composer.' + action, {
                composerData: composerData,
                data: data
            });
        });
    }

    function discard(post_uuid) {
        if (composer.posts[post_uuid]) {
            $('#cmp-uuid-' + post_uuid).remove();
            drafts.removeDraft(composer.posts[post_uuid].save_id);

            delete composer.posts[post_uuid];
            composer.active = undefined;
            taskbar.discard('composer', post_uuid);
            $('body').css({
                'margin-bottom': 0
            });
            $('[data-action="post"]').removeAttr('disabled');
            
            //added check to only remove the composing mobile class if there are no composing windows active
            if(!$('.composer')){
                $('html').removeClass('composing mobile');
            }

            if ($("#search-overlay").hasClass('active')) {
                $("#search-overlay").toggleClass("active");
            }
        }
    }

    composer.minimize = function (post_uuid) {
        composer.active = undefined;
        taskbar.minimize('composer', post_uuid);

        $('body').css({
            'margin-bottom': '0px'
        });
    };

    return composer;
});
