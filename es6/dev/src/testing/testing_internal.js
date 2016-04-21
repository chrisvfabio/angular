import { StringMapWrapper } from 'angular2/src/facade/collection';
import { global, isFunction, Math } from 'angular2/src/facade/lang';
import { provide } from 'angular2/core';
import { getTestInjector, FunctionWithParamTokens } from './test_injector';
import { browserDetection } from './utils';
export { inject } from './test_injector';
export { expect } from './matchers';
export var proxy = (t) => t;
var _global = (typeof window === 'undefined' ? global : window);
export var afterEach = _global.afterEach;
/**
 * Injectable completer that allows signaling completion of an asynchronous test. Used internally.
 */
export class AsyncTestCompleter {
    constructor(_done) {
        this._done = _done;
    }
    done() { this._done(); }
}
var jsmBeforeEach = _global.beforeEach;
var jsmDescribe = _global.describe;
var jsmDDescribe = _global.fdescribe;
var jsmXDescribe = _global.xdescribe;
var jsmIt = _global.it;
var jsmIIt = _global.fit;
var jsmXIt = _global.xit;
var runnerStack = [];
var inIt = false;
jasmine.DEFAULT_TIMEOUT_INTERVAL = 500;
var globalTimeOut = browserDetection.isSlow ? 3000 : jasmine.DEFAULT_TIMEOUT_INTERVAL;
var testInjector = getTestInjector();
/**
 * Mechanism to run `beforeEach()` functions of Angular tests.
 *
 * Note: Jasmine own `beforeEach` is used by this library to handle DI providers.
 */
class BeforeEachRunner {
    constructor(_parent) {
        this._parent = _parent;
        this._fns = [];
    }
    beforeEach(fn) { this._fns.push(fn); }
    run() {
        if (this._parent)
            this._parent.run();
        this._fns.forEach((fn) => {
            return isFunction(fn) ? fn() :
                (testInjector.execute(fn));
        });
    }
}
// Reset the test providers before each test
jsmBeforeEach(() => { testInjector.reset(); });
function _describe(jsmFn, ...args) {
    var parentRunner = runnerStack.length === 0 ? null : runnerStack[runnerStack.length - 1];
    var runner = new BeforeEachRunner(parentRunner);
    runnerStack.push(runner);
    var suite = jsmFn(...args);
    runnerStack.pop();
    return suite;
}
export function describe(...args) {
    return _describe(jsmDescribe, ...args);
}
export function ddescribe(...args) {
    return _describe(jsmDDescribe, ...args);
}
export function xdescribe(...args) {
    return _describe(jsmXDescribe, ...args);
}
export function beforeEach(fn) {
    if (runnerStack.length > 0) {
        // Inside a describe block, beforeEach() uses a BeforeEachRunner
        runnerStack[runnerStack.length - 1].beforeEach(fn);
    }
    else {
        // Top level beforeEach() are delegated to jasmine
        jsmBeforeEach(fn);
    }
}
/**
 * Allows overriding default providers defined in test_injector.js.
 *
 * The given function must return a list of DI providers.
 *
 * Example:
 *
 *   beforeEachProviders(() => [
 *     provide(Compiler, {useClass: MockCompiler}),
 *     provide(SomeToken, {useValue: myValue}),
 *   ]);
 */
export function beforeEachProviders(fn) {
    jsmBeforeEach(() => {
        var providers = fn();
        if (!providers)
            return;
        testInjector.addProviders(providers);
    });
}
/**
 * @deprecated
 */
export function beforeEachBindings(fn) {
    beforeEachProviders(fn);
}
function _it(jsmFn, name, testFn, testTimeOut) {
    var runner = runnerStack[runnerStack.length - 1];
    var timeOut = Math.max(globalTimeOut, testTimeOut);
    if (testFn instanceof FunctionWithParamTokens) {
        // The test case uses inject(). ie `it('test', inject([AsyncTestCompleter], (async) => { ...
        // }));`
        let testFnT = testFn;
        if (testFn.hasToken(AsyncTestCompleter)) {
            jsmFn(name, (done) => {
                var completerProvider = provide(AsyncTestCompleter, {
                    useFactory: () => {
                        // Mark the test as async when an AsyncTestCompleter is injected in an it()
                        if (!inIt)
                            throw new Error('AsyncTestCompleter can only be injected in an "it()"');
                        return new AsyncTestCompleter(done);
                    }
                });
                testInjector.addProviders([completerProvider]);
                runner.run();
                inIt = true;
                testInjector.execute(testFnT);
                inIt = false;
            }, timeOut);
        }
        else {
            jsmFn(name, () => {
                runner.run();
                testInjector.execute(testFnT);
            }, timeOut);
        }
    }
    else {
        // The test case doesn't use inject(). ie `it('test', (done) => { ... }));`
        if (testFn.length === 0) {
            jsmFn(name, () => {
                runner.run();
                testFn();
            }, timeOut);
        }
        else {
            jsmFn(name, (done) => {
                runner.run();
                testFn(done);
            }, timeOut);
        }
    }
}
export function it(name, fn, timeOut = null) {
    return _it(jsmIt, name, fn, timeOut);
}
export function xit(name, fn, timeOut = null) {
    return _it(jsmXIt, name, fn, timeOut);
}
export function iit(name, fn, timeOut = null) {
    return _it(jsmIIt, name, fn, timeOut);
}
export class SpyObject {
    constructor(type = null) {
        if (type) {
            for (var prop in type.prototype) {
                var m = null;
                try {
                    m = type.prototype[prop];
                }
                catch (e) {
                }
                if (typeof m === 'function') {
                    this.spy(prop);
                }
            }
        }
    }
    // Noop so that SpyObject has the same interface as in Dart
    noSuchMethod(args) { }
    spy(name) {
        if (!this[name]) {
            this[name] = this._createGuinnessCompatibleSpy(name);
        }
        return this[name];
    }
    prop(name, value) { this[name] = value; }
    static stub(object = null, config = null, overrides = null) {
        if (!(object instanceof SpyObject)) {
            overrides = config;
            config = object;
            object = new SpyObject();
        }
        var m = StringMapWrapper.merge(config, overrides);
        StringMapWrapper.forEach(m, (value, key) => { object.spy(key).andReturn(value); });
        return object;
    }
    /** @internal */
    _createGuinnessCompatibleSpy(name) {
        var newSpy = jasmine.createSpy(name);
        newSpy.andCallFake = newSpy.and.callFake;
        newSpy.andReturn = newSpy.and.returnValue;
        newSpy.reset = newSpy.calls.reset;
        // revisit return null here (previously needed for rtts_assert).
        newSpy.and.returnValue(null);
        return newSpy;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidGVzdGluZ19pbnRlcm5hbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImRpZmZpbmdfcGx1Z2luX3dyYXBwZXItb3V0cHV0X3BhdGgtaGpxenJDTTEudG1wL2FuZ3VsYXIyL3NyYy90ZXN0aW5nL3Rlc3RpbmdfaW50ZXJuYWwudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ik9BQU8sRUFBQyxnQkFBZ0IsRUFBQyxNQUFNLGdDQUFnQztPQUN4RCxFQUFDLE1BQU0sRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFDLE1BQU0sMEJBQTBCO09BRTFELEVBQUMsT0FBTyxFQUFDLE1BQU0sZUFBZTtPQUU5QixFQUFDLGVBQWUsRUFBRSx1QkFBdUIsRUFBUyxNQUFNLGlCQUFpQjtPQUN6RSxFQUFDLGdCQUFnQixFQUFDLE1BQU0sU0FBUztBQUd4QyxTQUFRLE1BQU0sUUFBTyxpQkFBaUIsQ0FBQztBQUV2QyxTQUFRLE1BQU0sUUFBbUIsWUFBWSxDQUFDO0FBRTlDLE9BQU8sSUFBSSxLQUFLLEdBQW1CLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUU1QyxJQUFJLE9BQU8sR0FBUSxDQUFDLE9BQU8sTUFBTSxLQUFLLFdBQVcsR0FBRyxNQUFNLEdBQUcsTUFBTSxDQUFDLENBQUM7QUFFckUsT0FBTyxJQUFJLFNBQVMsR0FBYSxPQUFPLENBQUMsU0FBUyxDQUFDO0FBTW5EOztHQUVHO0FBQ0g7SUFDRSxZQUFvQixLQUFlO1FBQWYsVUFBSyxHQUFMLEtBQUssQ0FBVTtJQUFHLENBQUM7SUFFdkMsSUFBSSxLQUFXLElBQUksQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDaEMsQ0FBQztBQUVELElBQUksYUFBYSxHQUFHLE9BQU8sQ0FBQyxVQUFVLENBQUM7QUFDdkMsSUFBSSxXQUFXLEdBQUcsT0FBTyxDQUFDLFFBQVEsQ0FBQztBQUNuQyxJQUFJLFlBQVksR0FBRyxPQUFPLENBQUMsU0FBUyxDQUFDO0FBQ3JDLElBQUksWUFBWSxHQUFHLE9BQU8sQ0FB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V0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzdCLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDaEIsQ0FBQztBQUNILENBQUM7QUFBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7U3RyaW5nTWFwV3JhcHBlcn0gZnJvbSAnYW5ndWxhcjIvc3JjL2ZhY2FkZS9jb2xsZWN0aW9uJztcbmltcG9ydCB7Z2xvYmFsLCBpc0Z1bmN0aW9uLCBNYXRofSBmcm9tICdhbmd1bGFyMi9zcmMvZmFjYWRlL2xhbmcnO1xuXG5pbXBvcnQge3Byb3ZpZGV9IGZyb20gJ2FuZ3VsYXIyL2NvcmUnO1xuXG5pbXBvcnQge2dldFRlc3RJbmplY3RvciwgRnVuY3Rpb25XaXRoUGFyYW1Ub2tlbnMsIGluamVjdH0gZnJvbSAnLi90ZXN0X2luamVjdG9yJztcbmltcG9ydCB7YnJvd3NlckRldGVjdGlvbn0gZnJvbSAnLi91dGlscyc7XG5pbXBvcnQge05nWm9uZX0gZnJvbSAnYW5ndWxhcjIvc3JjL2NvcmUvem9uZS9uZ196b25lJztcblxuZXhwb3J0IHtpbmplY3R9IGZyb20gJy4vdGVzdF9pbmplY3Rvcic7XG5cbmV4cG9ydCB7ZXhwZWN0LCBOZ01hdGNoZXJzfSBmcm9tICcuL21hdGNoZXJzJztcblxuZXhwb3J0IHZhciBwcm94eTogQ2xhc3NEZWNvcmF0b3IgPSAodCkgPT4gdDtcblxudmFyIF9nbG9iYWwgPSA8YW55Pih0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJyA/IGdsb2JhbCA6IHdpbmRvdyk7XG5cbmV4cG9ydCB2YXIgYWZ0ZXJFYWNoOiBGdW5jdGlvbiA9IF9nbG9iYWwuYWZ0ZXJFYWNoO1xuXG5leHBvcnQgdHlwZSBTeW5jVGVzdEZuID0gKCkgPT4gdm9pZDtcbnR5cGUgQXN5bmNUZXN0Rm4gPSAoZG9uZTogKCkgPT4gdm9pZCkgPT4gdm9pZDtcbnR5cGUgQW55VGVzdEZuID0gU3luY1Rlc3RGbiB8IEFzeW5jVGVzdEZuO1xuXG4vKipcbiAqIEluamVjdGFibGUgY29tcGxldGVyIHRoYXQgYWxsb3dzIHNpZ25hbGluZyBjb21wbGV0aW9uIG9mIGFuIGFzeW5jaHJvbm91cyB0ZXN0LiBVc2VkIGludGVybmFsbHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBBc3luY1Rlc3RDb21wbGV0ZXIge1xuICBjb25zdHJ1Y3Rvcihwcml2YXRlIF9kb25lOiBGdW5jdGlvbikge31cblxuICBkb25lKCk6IHZvaWQgeyB0aGlzLl9kb25lKCk7IH1cbn1cblxudmFyIGpzbUJlZm9yZUVhY2ggPSBfZ2xvYmFsLmJlZm9yZUVhY2g7XG52YXIganNtRGVzY3JpYmUgPSBfZ2xvYmFsLmRlc2NyaWJlO1xudmFyIGpzbUREZXNjcmliZSA9IF9nbG9iYWwuZmRlc2NyaWJlO1xudmFyIGpzbVhEZXNjcmliZSA9IF9nbG9iYWwueGRlc2NyaWJlO1xudmFyIGpzbUl0ID0gX2dsb2JhbC5pdDtcbnZhciBqc21JSXQgPSBfZ2xvYmFsLmZpdDtcbnZhciBqc21YSXQgPSBfZ2xvYmFsLnhpdDtcblxudmFyIHJ1bm5lclN0YWNrID0gW107XG52YXIgaW5JdCA9IGZhbHNlO1xuamFzbWluZS5ERUZBVUxUX1RJTUVPVVRfSU5URVJWQUwgPSA1MDA7XG52YXIgZ2xvYmFsVGltZU91dCA9IGJyb3dzZXJEZXRlY3Rpb24uaXNTbG93ID8gMzAwMCA6IGphc21pbmUuREVGQVVMVF9USU1FT1VUX0lOVEVSVkFMO1xuXG52YXIgdGVzdEluamVjdG9yID0gZ2V0VGVzdEluamVjdG9yKCk7XG5cbi8qKlxuICogTWVjaGFuaXNtIHRvIHJ1biBgYmVmb3JlRWFjaCgpYCBmdW5jdGlvbnMgb2YgQW5ndWxhciB0ZXN0cy5cbiAqXG4gKiBOb3RlOiBKYXNtaW5lIG93biBgYmVmb3JlRWFjaGAgaXMgdXNlZCBieSB0aGlzIGxpYnJhcnkgdG8gaGFuZGxlIERJIHByb3ZpZGVycy5cbiAqL1xuY2xhc3MgQmVmb3JlRWFjaFJ1bm5lciB7XG4gIHByaXZhdGUgX2ZuczogQXJyYXk8RnVuY3Rpb25XaXRoUGFyYW1Ub2tlbnMgfCBTeW5jVGVzdEZuPiA9IFtdO1xuXG4gIGNvbnN0cnVjdG9yKHByaXZhdGUgX3BhcmVudDogQmVmb3JlRWFjaFJ1bm5lcikge31cblxuICBiZWZvcmVFYWNoKGZuOiBGdW5jdGlvbldpdGhQYXJhbVRva2VucyB8IFN5bmNUZXN0Rm4pOiB2b2lkIHsgdGhpcy5fZm5zLnB1c2goZm4pOyB9XG5cbiAgcnVuKCk6IHZvaWQge1xuICAgIGlmICh0aGlzLl9wYXJlbnQpIHRoaXMuX3BhcmVudC5ydW4oKTtcbiAgICB0aGlzLl9mbnMuZm9yRWFjaCgoZm4pID0+IHtcbiAgICAgIHJldHVybiBpc0Z1bmN0aW9uKGZuKSA/ICg8U3luY1Rlc3RGbj5mbikoKSA6XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAodGVzdEluamVjdG9yLmV4ZWN1dGUoPEZ1bmN0aW9uV2l0aFBhcmFtVG9rZW5zPmZuKSk7XG4gICAgfSk7XG4gIH1cbn1cblxuLy8gUmVzZXQgdGhlIHRlc3QgcHJvdmlkZXJzIGJlZm9yZSBlYWNoIHRlc3RcbmpzbUJlZm9yZUVhY2goKCkgPT4geyB0ZXN0SW5qZWN0b3IucmVzZXQoKTsgfSk7XG5cbmZ1bmN0aW9uIF9kZXNjcmliZShqc21GbiwgLi4uYXJncykge1xuICB2YXIgcGFyZW50UnVubmVyID0gcnVubmVyU3RhY2subGVuZ3RoID09PSAwID8gbnVsbCA6IHJ1bm5lclN0YWNrW3J1bm5lclN0YWNrLmxlbmd0aCAtIDFdO1xuICB2YXIgcnVubmVyID0gbmV3IEJlZm9yZUVhY2hSdW5uZXIocGFyZW50UnVubmVyKTtcbiAgcnVubmVyU3RhY2sucHVzaChydW5uZXIpO1xuICB2YXIgc3VpdGUgPSBqc21GbiguLi5hcmdzKTtcbiAgcnVubmVyU3RhY2sucG9wKCk7XG4gIHJldHVybiBzdWl0ZTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGRlc2NyaWJlKC4uLmFyZ3MpOiB2b2lkIHtcbiAgcmV0dXJuIF9kZXNjcmliZShqc21EZXNjcmliZSwgLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBkZGVzY3JpYmUoLi4uYXJncyk6IHZvaWQge1xuICByZXR1cm4gX2Rlc2NyaWJlKGpzbUREZXNjcmliZSwgLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB4ZGVzY3JpYmUoLi4uYXJncyk6IHZvaWQge1xuICByZXR1cm4gX2Rlc2NyaWJlKGpzbVhEZXNjcmliZSwgLi4uYXJncyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBiZWZvcmVFYWNoKGZuOiBGdW5jdGlvbldpdGhQYXJhbVRva2VucyB8IFN5bmNUZXN0Rm4pOiB2b2lkIHtcbiAgaWYgKHJ1bm5lclN0YWNrLmxlbmd0aCA+IDApIHtcbiAgICAvLyBJbnNpZGUgYSBkZXNjcmliZSBibG9jaywgYmVmb3JlRWFjaCgpIHVzZXMgYSBCZWZvcmVFYWNoUnVubmVyXG4gICAgcnVubmVyU3RhY2tbcnVubmVyU3RhY2subGVuZ3RoIC0gMV0uYmVmb3JlRWFjaChmbik7XG4gIH0gZWxzZSB7XG4gICAgLy8gVG9wIGxldmVsIGJlZm9yZUVhY2goKSBhcmUgZGVsZWdhdGVkIHRvIGphc21pbmVcbiAgICBqc21CZWZvcmVFYWNoKDxTeW5jVGVzdEZuPmZuKTtcbiAgfVxufVxuXG4vKipcbiAqIEFsbG93cyBvdmVycmlkaW5nIGRlZmF1bHQgcHJvdmlkZXJzIGRlZmluZWQgaW4gdGVzdF9pbmplY3Rvci5qcy5cbiAqXG4gKiBUaGUgZ2l2ZW4gZnVuY3Rpb24gbXVzdCByZXR1cm4gYSBsaXN0IG9mIERJIHByb3ZpZGVycy5cbiAqXG4gKiBFeGFtcGxlOlxuICpcbiAqICAgYmVmb3JlRWFjaFByb3ZpZGVycygoKSA9PiBbXG4gKiAgICAgcHJvdmlkZShDb21waWxlciwge3VzZUNsYXNzOiBNb2NrQ29tcGlsZXJ9KSxcbiAqICAgICBwcm92aWRlKFNvbWVUb2tlbiwge3VzZVZhbHVlOiBteVZhbHVlfSksXG4gKiAgIF0pO1xuICovXG5leHBvcnQgZnVuY3Rpb24gYmVmb3JlRWFjaFByb3ZpZGVycyhmbik6IHZvaWQge1xuICBqc21CZWZvcmVFYWNoKCgpID0+IHtcbiAgICB2YXIgcHJvdmlkZXJzID0gZm4oKTtcbiAgICBpZiAoIXByb3ZpZGVycykgcmV0dXJuO1xuICAgIHRlc3RJbmplY3Rvci5hZGRQcm92aWRlcnMocHJvdmlkZXJzKTtcbiAgfSk7XG59XG5cbi8qKlxuICogQGRlcHJlY2F0ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJlZm9yZUVhY2hCaW5kaW5ncyhmbik6IHZvaWQge1xuICBiZWZvcmVFYWNoUHJvdmlkZXJzKGZuKTtcbn1cblxuZnVuY3Rpb24gX2l0KGpzbUZuOiBGdW5jdGlvbiwgbmFtZTogc3RyaW5nLCB0ZXN0Rm46IEZ1bmN0aW9uV2l0aFBhcmFtVG9rZW5zIHwgQW55VGVzdEZuLFxuICAgICAgICAgICAgIHRlc3RUaW1lT3V0OiBudW1iZXIpOiB2b2lkIHtcbiAgdmFyIHJ1bm5lciA9IHJ1bm5lclN0YWNrW3J1bm5lclN0YWNrLmxlbmd0aCAtIDFdO1xuICB2YXIgdGltZU91dCA9IE1hdGgubWF4KGdsb2JhbFRpbWVPdXQsIHRlc3RUaW1lT3V0KTtcblxuICBpZiAodGVzdEZuIGluc3RhbmNlb2YgRnVuY3Rpb25XaXRoUGFyYW1Ub2tlbnMpIHtcbiAgICAvLyBUaGUgdGVzdCBjYXNlIHVzZXMgaW5qZWN0KCkuIGllIGBpdCgndGVzdCcsIGluamVjdChbQXN5bmNUZXN0Q29tcGxldGVyXSwgKGFzeW5jKSA9PiB7IC4uLlxuICAgIC8vIH0pKTtgXG4gICAgbGV0IHRlc3RGblQgPSB0ZXN0Rm47XG5cbiAgICBpZiAodGVzdEZuLmhhc1Rva2VuKEFzeW5jVGVzdENvbXBsZXRlcikpIHtcbiAgICAgIGpzbUZuKG5hbWUsIChkb25lKSA9PiB7XG4gICAgICAgIHZhciBjb21wbGV0ZXJQcm92aWRlciA9IHByb3ZpZGUoQXN5bmNUZXN0Q29tcGxldGVyLCB7XG4gICAgICAgICAgdXNlRmFjdG9yeTogKCkgPT4ge1xuICAgICAgICAgICAgLy8gTWFyayB0aGUgdGVzdCBhcyBhc3luYyB3aGVuIGFuIEFzeW5jVGVzdENvbXBsZXRlciBpcyBpbmplY3RlZCBpbiBhbiBpdCgpXG4gICAgICAgICAgICBpZiAoIWluSXQpIHRocm93IG5ldyBFcnJvcignQXN5bmNUZXN0Q29tcGxldGVyIGNhbiBvbmx5IGJlIGluamVjdGVkIGluIGFuIFwiaXQoKVwiJyk7XG4gICAgICAgICAgICByZXR1cm4gbmV3IEFzeW5jVGVzdENvbXBsZXRlcihkb25lKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHRlc3RJbmplY3Rvci5hZGRQcm92aWRlcnMoW2NvbXBsZXRlclByb3ZpZGVyXSk7XG4gICAgICAgIHJ1bm5lci5ydW4oKTtcblxuICAgICAgICBpbkl0ID0gdHJ1ZTtcbiAgICAgICAgdGVzdEluamVjdG9yLmV4ZWN1dGUodGVzdEZuVCk7XG4gICAgICAgIGluSXQgPSBmYWxzZTtcbiAgICAgIH0sIHRpbWVPdXQpO1xuICAgIH0gZWxzZSB7XG4gICAgICBqc21GbihuYW1lLCAoKSA9PiB7XG4gICAgICAgIHJ1bm5lci5ydW4oKTtcbiAgICAgICAgdGVzdEluamVjdG9yLmV4ZWN1dGUodGVzdEZuVCk7XG4gICAgICB9LCB0aW1lT3V0KTtcbiAgICB9XG5cbiAgfSBlbHNlIHtcbiAgICAvLyBUaGUgdGVzdCBjYXNlIGRvZXNuJ3QgdXNlIGluamVjdCgpLiBpZSBgaXQoJ3Rlc3QnLCAoZG9uZSkgPT4geyAuLi4gfSkpO2BcblxuICAgIGlmICgoPGFueT50ZXN0Rm4pLmxlbmd0aCA9PT0gMCkge1xuICAgICAganNtRm4obmFtZSwgKCkgPT4ge1xuICAgICAgICBydW5uZXIucnVuKCk7XG4gICAgICAgICg8U3luY1Rlc3RGbj50ZXN0Rm4pKCk7XG4gICAgICB9LCB0aW1lT3V0KTtcbiAgICB9IGVsc2Uge1xuICAgICAganNtRm4obmFtZSwgKGRvbmUpID0+IHtcbiAgICAgICAgcnVubmVyLnJ1bigpO1xuICAgICAgICAoPEFzeW5jVGVzdEZuPnRlc3RGbikoZG9uZSk7XG4gICAgICB9LCB0aW1lT3V0KTtcbiAgICB9XG4gIH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGl0KG5hbWUsIGZuLCB0aW1lT3V0ID0gbnVsbCk6IHZvaWQge1xuICByZXR1cm4gX2l0KGpzbUl0LCBuYW1lLCBmbiwgdGltZU91dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB4aXQobmFtZSwgZm4sIHRpbWVPdXQgPSBudWxsKTogdm9pZCB7XG4gIHJldHVybiBfaXQoanNtWEl0LCBuYW1lLCBmbiwgdGltZU91dCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpaXQobmFtZSwgZm4sIHRpbWVPdXQgPSBudWxsKTogdm9pZCB7XG4gIHJldHVybiBfaXQoanNtSUl0LCBuYW1lLCBmbiwgdGltZU91dCk7XG59XG5cblxuZXhwb3J0IGludGVyZmFjZSBHdWluZXNzQ29tcGF0aWJsZVNweSBleHRlbmRzIGphc21pbmUuU3B5IHtcbiAgLyoqIEJ5IGNoYWluaW5nIHRoZSBzcHkgd2l0aCBhbmQucmV0dXJuVmFsdWUsIGFsbCBjYWxscyB0byB0aGUgZnVuY3Rpb24gd2lsbCByZXR1cm4gYSBzcGVjaWZpY1xuICAgKiB2YWx1ZS4gKi9cbiAgYW5kUmV0dXJuKHZhbDogYW55KTogdm9pZDtcbiAgLyoqIEJ5IGNoYWluaW5nIHRoZSBzcHkgd2l0aCBhbmQuY2FsbEZha2UsIGFsbCBjYWxscyB0byB0aGUgc3B5IHdpbGwgZGVsZWdhdGUgdG8gdGhlIHN1cHBsaWVkXG4gICAqIGZ1bmN0aW9uLiAqL1xuICBhbmRDYWxsRmFrZShmbjogRnVuY3Rpb24pOiBHdWluZXNzQ29tcGF0aWJsZVNweTtcbiAgLyoqIHJlbW92ZXMgYWxsIHJlY29yZGVkIGNhbGxzICovXG4gIHJlc2V0KCk7XG59XG5cbmV4cG9ydCBjbGFzcyBTcHlPYmplY3Qge1xuICBjb25zdHJ1Y3Rvcih0eXBlID0gbnVsbCkge1xuICAgIGlmICh0eXBlKSB7XG4gICAgICBmb3IgKHZhciBwcm9wIGluIHR5cGUucHJvdG90eXBlKSB7XG4gICAgICAgIHZhciBtID0gbnVsbDtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICBtID0gdHlwZS5wcm90b3R5cGVbcHJvcF07XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAvLyBBcyB3ZSBhcmUgY3JlYXRpbmcgc3B5cyBmb3IgYWJzdHJhY3QgY2xhc3NlcyxcbiAgICAgICAgICAvLyB0aGVzZSBjbGFzc2VzIG1pZ2h0IGhhdmUgZ2V0dGVycyB0aGF0IHRocm93IHdoZW4gdGhleSBhcmUgYWNjZXNzZWQuXG4gICAgICAgICAgLy8gQXMgd2UgYXJlIG9ubHkgYXV0byBjcmVhdGluZyBzcHlzIGZvciBtZXRob2RzLCB0aGlzXG4gICAgICAgICAgLy8gc2hvdWxkIG5vdCBtYXR0ZXIuXG4gICAgICAgIH1cbiAgICAgICAgaWYgKHR5cGVvZiBtID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICAgICAgdGhpcy5zcHkocHJvcCk7XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgLy8gTm9vcCBzbyB0aGF0IFNweU9iamVjdCBoYXMgdGhlIHNhbWUgaW50ZXJmYWNlIGFzIGluIERhcnRcbiAgbm9TdWNoTWV0aG9kKGFyZ3MpIHt9XG5cbiAgc3B5KG5hbWUpIHtcbiAgICBpZiAoIXRoaXNbbmFtZV0pIHtcbiAgICAgIHRoaXNbbmFtZV0gPSB0aGlzLl9jcmVhdGVHdWlubmVzc0NvbXBhdGlibGVTcHkobmFtZSk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzW25hbWVdO1xuICB9XG5cbiAgcHJvcChuYW1lLCB2YWx1ZSkgeyB0aGlzW25hbWVdID0gdmFsdWU7IH1cblxuICBzdGF0aWMgc3R1YihvYmplY3QgPSBudWxsLCBjb25maWcgPSBudWxsLCBvdmVycmlkZXMgPSBudWxsKSB7XG4gICAgaWYgKCEob2JqZWN0IGluc3RhbmNlb2YgU3B5T2JqZWN0KSkge1xuICAgICAgb3ZlcnJpZGVzID0gY29uZmlnO1xuICAgICAgY29uZmlnID0gb2JqZWN0O1xuICAgICAgb2JqZWN0ID0gbmV3IFNweU9iamVjdCgpO1xuICAgIH1cblxuICAgIHZhciBtID0gU3RyaW5nTWFwV3JhcHBlci5tZXJnZShjb25maWcsIG92ZXJyaWRlcyk7XG4gICAgU3RyaW5nTWFwV3JhcHBlci5mb3JFYWNoKG0sICh2YWx1ZSwga2V5KSA9PiB7IG9iamVjdC5zcHkoa2V5KS5hbmRSZXR1cm4odmFsdWUpOyB9KTtcbiAgICByZXR1cm4gb2JqZWN0O1xuICB9XG5cbiAgLyoqIEBpbnRlcm5hbCAqL1xuICBfY3JlYXRlR3Vpbm5lc3NDb21wYXRpYmxlU3B5KG5hbWUpOiBHdWluZXNzQ29tcGF0aWJsZVNweSB7XG4gICAgdmFyIG5ld1NweTogR3VpbmVzc0NvbXBhdGlibGVTcHkgPSA8YW55Pmphc21pbmUuY3JlYXRlU3B5KG5hbWUpO1xuICAgIG5ld1NweS5hbmRDYWxsRmFrZSA9IDxhbnk+bmV3U3B5LmFuZC5jYWxsRmFrZTtcbiAgICBuZXdTcHkuYW5kUmV0dXJuID0gPGFueT5uZXdTcHkuYW5kLnJldHVyblZhbHVlO1xuICAgIG5ld1NweS5yZXNldCA9IDxhbnk+bmV3U3B5LmNhbGxzLnJlc2V0O1xuICAgIC8vIHJldmlzaXQgcmV0dXJuIG51bGwgaGVyZSAocHJldmlvdXNseSBuZWVkZWQgZm9yIHJ0dHNfYXNzZXJ0KS5cbiAgICBuZXdTcHkuYW5kLnJldHVyblZhbHVlKG51bGwpO1xuICAgIHJldHVybiBuZXdTcHk7XG4gIH1cbn1cbiJdfQ==