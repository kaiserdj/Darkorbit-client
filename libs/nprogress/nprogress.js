(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define(factory);
    } else if (typeof exports === 'object') {
        module.exports = factory();
    } else {
        root.NProgress = factory();
    }
})(this, function () {
    const NProgress = {
        version: '0.2.0',
        settings: {
            minimum: 0.08,
            easing: 'ease',
            positionUsing: '',
            speed: 200,
            trickle: true,
            trickleRate: 0.02,
            trickleSpeed: 800,
            showSpinner: true,
            barSelector: '[role="bar"]',
            spinnerSelector: '[role="spinner"]',
            parent: 'body',
            template: '<div class="bar" role="bar"><div class="peg"></div></div><div class="spinner" role="spinner"><div class="spinner-icon"></div></div>'
        },
        status: null,
        configure(options) {
            Object.keys(options).forEach(key => {
                if (options[key] !== undefined) this.settings[key] = options[key];
            });
            return this;
        },
        set(n) {
            const started = this.isStarted();
            n = clamp(n, this.settings.minimum, 1);
            this.status = (n === 1 ? null : n);
            const progress = this.render(!started),
                bar = progress.querySelector(this.settings.barSelector),
                {speed, easing} = this.settings;
            forceReflow(progress);
            queue(next => {
                if (!this.settings.positionUsing) this.settings.positionUsing = getPositioningCSS();
                applyCSS(bar, barPositionCSS(n, speed, easing));
                if (n === 1) {
                    fadeOut(progress, speed, next);
                } else {
                    setTimeout(next, speed);
                }
            });
            return this;
        },
        isStarted() {
            return typeof this.status === 'number';
        },
        start() {
            if (!this.status) this.set(0);
            if (this.settings.trickle) {
                const trickle = () => setTimeout(() => {
                    if (!this.status) return;
                    this.trickle();
                    trickle();
                }, this.settings.trickleSpeed);
                trickle();
            }
            return this;
        },
        done(force) {
            if (!force && !this.status) return this;
            return this.inc(0.3 + 0.5 * Math.random()).set(1);
        },
        inc(amount) {
            if (!this.status) return this.start();
            if (typeof amount !== 'number') {
                amount = (1 - this.status) * clamp(Math.random() * this.status, 0.1, 0.95);
            }
            const n = clamp(this.status + amount, 0, 0.994);
            return this.set(n);
        },
        trickle() {
            return this.inc(Math.random() * this.settings.trickleRate);
        },
        promise($promise) {
            if (!$promise || $promise.state() === "resolved") return this;
            let initial = 0, current = 0;
            if (current === 0) this.start();
            initial++;
            current++;
            $promise.always(() => {
                current--;
                if (current === 0) {
                    initial = 0;
                    this.done();
                } else {
                    this.set((initial - current) / initial);
                }
            });
            return this;
        },
        render(fromStart) {
            if (this.isRendered()) return document.getElementById('nprogress');
            addClass(document.documentElement, 'nprogress-busy');
            const progress = createProgressElement(this.settings.template);
            const bar = progress.querySelector(this.settings.barSelector),
                perc = fromStart ? '-100' : toBarPerc(this.status || 0),
                parent = document.querySelector(this.settings.parent);
            applyCSS(bar, {transition: 'all 0 linear', transform: `translate3d(${perc}%,0,0)`});
            if (!this.settings.showSpinner) removeElement(progress.querySelector(this.settings.spinnerSelector));
            if (parent !== document.body) addClass(parent, 'nprogress-custom-parent');
            parent.appendChild(progress);
            return progress;
        },
        remove() {
            removeClass(document.documentElement, 'nprogress-busy');
            removeClass(document.querySelector(this.settings.parent), 'nprogress-custom-parent');
            const progress = document.getElementById('nprogress');
            progress && removeElement(progress);
        },
        isRendered() {
            return !!document.getElementById('nprogress');
        }
    };

    function clamp(n, min, max) {
        return Math.min(Math.max(n, min), max);
    }

    function toBarPerc(n) {
        return (-1 + n) * 100;
    }

    function barPositionCSS(n, speed, ease) {
        const positionUsing = NProgress.settings.positionUsing;
        const transform = positionUsing === 'translate3d' ? `translate3d(${toBarPerc(n)}%,0,0)` :
            positionUsing === 'translate' ? `translate(${toBarPerc(n)}%,0)` :
                {'margin-left': `${toBarPerc(n)}%`};
        return {...transform, transition: `all ${speed}ms ${ease}`};
    }

    function queue(fn) {
        const pending = [];
        const next = () => {
            const fn = pending.shift();
            if (fn) fn(next);
        };
        return function (fn) {
            pending.push(fn);
            if (pending.length === 1) next();
        };
    }

    function applyCSS(element, properties) {
        Object.keys(properties).forEach(prop => {
            element.style[getVendorProp(prop)] = properties[prop];
        });
    }

    function getVendorProp(name) {
        const camelCased = camelCase(name);
        if (camelCased in document.body.style) return camelCased;
        const vendorNames = ['Webkit', 'O', 'Moz', 'ms'].map(prefix => prefix + capitalize(camelCased));
        return vendorNames.find(vendorName => vendorName in document.body.style) || name;
    }

    function camelCase(string) {
        return string.replace(/^-ms-/, 'ms-').replace(/-([\da-z])/gi, (match, letter) => letter.toUpperCase());
    }

    function capitalize(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    function fadeOut(element, speed, callback) {
        applyCSS(element, {transition: 'none', opacity: 1});
        forceReflow(element);
        setTimeout(() => {
            applyCSS(element, {transition: `all ${speed}ms linear`, opacity: 0});
            setTimeout(() => {
                NProgress.remove();
                callback();
            }, speed);
        }, speed);
    }

    function forceReflow(element) {
        element.offsetWidth;
    }

    function addClass(element, name) {
        if (!hasClass(element, name)) {
            element.className += ` ${name}`;
        }
    }

    function removeClass(element, name) {
        if (hasClass(element, name)) {
            element.className = element.className.replace(new RegExp(`\\b${name}\\b`, 'g'), '').trim();
        }
    }

    function hasClass(element, name) {
        return element.className.split(' ').includes(name);
    }

    function createProgressElement(template) {
        const progress = document.createElement('div');
        progress.id = 'nprogress';
        progress.innerHTML = template;
        return progress;
    }

    function removeElement(element) {
        element && element.parentNode && element.parentNode.removeChild(element);
    }

    function getPositioningCSS() {
        const bodyStyle = document.body.style;
        const vendorPrefix = ['Webkit', 'Moz', 'ms', 'O'].find(prefix => `${prefix}Transform` in bodyStyle) || '';
        return vendorPrefix && `${vendorPrefix}Perspective` in bodyStyle ? 'translate3d' : 'translate';
    }

    return NProgress;
});
