'use strict';

/* globals app, define, config, utils*/

define('composer/resize', [], function(autosize) {
    var resize = {},
        oldPercentage = 0,
        minimumPercentage = 0.3,
        snapMargin = $('#main-nav').height() / $(window).height();

    var $body = $('body'),
        $html = $('html'),
        $window = $(window),
        $headerMenu = $('#main-nav');


    resize.reposition = function(postContainer) {
        var percentage = localStorage.getItem('composer:resizePercentage') || 0.5;
        //BEGIN PG
        var widthPercentage = localStorage.getItem('composer:resizeWidthPercentage') || 0.5;
        //END
        if (percentage >= 1 - snapMargin) {
            percentage = 1;
            postContainer.addClass('maximized');
        }

        doResize(postContainer, percentage, widthPercentage);
    };

    function doResize(postContainer, percentage, widthPercentage) {
        var env = utils.findBootstrapEnvironment();


        // todo, lump in browsers that don't support transform (ie8) here
        // at this point we should use modernizr

        // done, just use `top` instead of `translate`

        //if (env === 'sm' || env === 'xs' || window.innerHeight < 480) {
        if (env === 'sm' || env === 'xs' || window.innerHeight < 10) {

            $html.addClass('composing mobile');
            /*postContainer.css({
            		'left': 0
            	});*/

            //autosize(postContainer.find('textarea')[0]);
            percentage = 1;

            widthPercentage=1;


        } else {
            $html.removeClass('composing mobile');
        }

        if (percentage && widthPercentage) {
            var upperBound = getUpperBound();

            var windowHeight = $window.height();

            if (percentage < minimumPercentage) {
                percentage = minimumPercentage;
            } else if (percentage >= 1) {
                percentage = 1;
            }


            //BEGIN pg-mod. This is changed  from original 
            if (widthPercentage < minimumPercentage) {
                widthPercentage = minimumPercentage;
            } else if (widthPercentage >= 1) {
                widthPercentage = 1;
            }
            if (env === 'md' || env === 'lg' && postContainer.hasClass('pg-resizing')) {
                var windowWidth = $window.width();


                var top = percentage * (windowHeight - upperBound) / windowHeight;

                top = (Math.abs(1 - top) * 100) + '%';

                var height = percentage * windowHeight;
                var width = widthPercentage * windowWidth;

                /*postContainer.css({
                	'top': top
                });*/
                postContainer.css({
                    'height': height,
                    'width': width
                });

            }
            //END  
            else {
                postContainer.removeAttr('style');
            }
        }

        postContainer.percentage = percentage;
        postContainer.css('visibility', 'visible');

        // Add some extra space at the bottom of the body so that the user can still scroll to the last post w/ composer open
        // thanks but don't do it on mobile
        /*if (env === 'md' || env === 'lg') {
        	$body.css({ 'margin-bottom': postContainer.outerHeight() });
        }*/

        resizeWritePreview(postContainer);
    }

    var resizeIt = doResize;

    var raf = window.requestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.mozRequestAnimationFrame;

    if (raf) {
        resizeIt = function(postContainer, percentage, widthPercentage) {
            raf(function() {
                doResize(postContainer, percentage, widthPercentage);
            });
        };
    }

    resize.handleResize = function(postContainer) {

        function resizeStart(e) {
            resizeActive = true;

            //BEGIN pg-mod
            if (!postContainer.hasClass('pg-resizing')) {
                postContainer.addClass('pg-resizing');

            }
            //END pg-mod
            var resizeRect = resizeEl[0].getBoundingClientRect(),
                resizeCenterY = resizeRect.top + (resizeRect.height / 2),
                 resizeCenterX = resizeRect.left + (resizeRect.width / 2);




            resizeOffset = (resizeCenterY - e.clientY) / 2,
                        resizeOffsetWidth = (resizeCenterX - e.clientX) / 2;

            resizeDown = e.clientY;
            resizeLeft = e.clientX;

            $window.on('mousemove', resizeAction);
            $window.on('mouseup', resizeStop);
            $body.on('touchmove', resizeTouchAction);
        }

        function resizeStop(e) {
            //BEGIN pg-mod
            if (postContainer.hasClass('pg-resizing')) {
                postContainer.removeClass('pg-resizing');
            }
            //END pg-mod

            resizeActive = false;

            postContainer.find('textarea').focus();
            $window.off('mousemove', resizeAction);
            $window.off('mouseup', resizeStop);
            $body.off('touchmove', resizeTouchAction);

            var position = (e.clientY - resizeOffset),
                windowHeight = $window.height(),
                upperBound = getUpperBound(),
                newHeight = windowHeight - position,
                ratio = newHeight / (windowHeight - upperBound);

            //BEGIN PG-mod

            var positionLeft = (e.clientX - resizeOffsetWidth),
                windowWidth = $window.width(),
                newWidth = windowWidth - position,
                ratioWidth = newWidth / windowWidth;

            //resizeSavePosition(ratioWidth);

            //END PG-mod
            if (ratio >= 1 - snapMargin) {
                snapToTop = true;
            } else {
                snapToTop = false;
            }

            resizeSavePosition(ratio, ratioWidth);

            //toggleMaximize(e);
        }

       /* function toggleMaximize(e) {
            if (e.clientY - resizeDown === 0 || snapToTop) {
                var newPercentage = 1;

                if (!postContainer.hasClass('maximized') || !snapToTop) {
                    oldPercentage = postContainer.percentage;
                    resizeIt(postContainer, newPercentage);
                    postContainer.addClass('maximized');
                } else {
                    newPercentage = (oldPercentage >= 1 - snapMargin || oldPercentage == 0) ? 0.5 : oldPercentage;
                    resizeIt(postContainer, newPercentage);
                    postContainer.removeClass('maximized');
                }

                resizeSavePosition(newPercentage);
            }
        }*/

        function resizeTouchAction(e) {
            e.preventDefault();
           // resizeAction(e.touches[0]);
           resizeAction(e.touches[0]);
        }

        function resizeAction(e) {
            if (resizeActive) {

                var position = (e.clientY - resizeOffset),
                    windowHeight = position + $window.height(),
                    upperBound = getUpperBound(),
                    newHeight = windowHeight - position,
                    ratio = newHeight / (windowHeight - upperBound);
                //Begin PG-mod

                var positionLeft = (e.clientX - resizeOffsetWidth),
                    windowWidth = position + $window.width(),
                    newWidth = windowWidth - positionLeft,
                    ratioWidth = newWidth / windowWidth;
                //END PG-mod
                resizeIt(postContainer, ratio, ratioWidth);

                resizeWritePreview(postContainer);

                if (Math.abs(e.clientY - resizeDown) > 0) {
                    postContainer.removeClass('maximized');
                }
            }

            if(typeof e.preventDefault ==='function'){
                e.preventDefault();
            }
            
            return false;
        }

        function resizeSavePosition(percentage, widthPercentage) {
            localStorage.setItem('composer:resizePercentage', percentage <= 1 ? percentage : 1); //BEGIN PG-mod
            localStorage.setItem('composer:resizeWidthPercentage', widthPercentage <= 1 ? widthPercentage : 1);
            //END PG-mod

        }

        var resizeActive = false,
            resizeOffset = 0,
            resizeOffsetWidth=0,
            resizeDown = 0,
            resizeLeft =0,
            snapToTop = false,
            resizeEl = postContainer.find('.resizer');

        resizeEl
            .on('mousedown', resizeStart)
            .on('touchstart', function(e) {
                e.preventDefault();
                resizeStart(e.touches[0]);
            })
            .on('touchend', function(e) {
                e.preventDefault();
                resizeStop(e);
            });

    };

    function getUpperBound() {
		try {
			var rect = $headerMenu.get(0).getBoundingClientRect();
			return rect.height + rect.top;
		} catch (e) {
			return 0;
		}
	}

    function resizeWritePreview(postContainer) {
        var total = getFormattingHeight(postContainer),
            containerHeight = postContainer.height() + 20 - total;

       postContainer
            .find('.write-preview-container')
            .css('height', containerHeight);


        $window.trigger('action:composer.resize', {
            formattingHeight: total,
            containerHeight: containerHeight
        });
    }

    function getFormattingHeight(postContainer) {
        return [
            //pg-mod
            postContainer.find('.pg-composer-header').outerHeight(true),
            //end mod
            postContainer.find('.title-container').outerHeight(true),
            postContainer.find('.formatting-bar').outerHeight(true),
            postContainer.find('.topic-thumb-container').outerHeight(true) || 0,
            postContainer.find('.tag-row').outerHeight(true),
            $('.taskbar').height() || 50
        ].reduce(function(a, b) {
            return a + b;
        });
    }


    return resize;
});
