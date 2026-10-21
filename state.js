/* 与画面分离的流程状态：所有解锁与奖励都经过同一条路径。 */
(function (root) {
  "use strict";
  class Journey {
    constructor() { this.reset(); }
    reset() { this.chapter = 0; this.tasks = [new Set(), new Set(), new Set()]; this.choices = {}; this.stage = "explore"; this.stars = []; this.ended = false; }
    doTask(chapter, id) {
      const allowed = [["flower-0", "flower-1", "flower-2"], ["letter"], ["lamp-0", "lamp-1", "lamp-2"]];
      if (chapter !== this.chapter || this.stage !== "explore" || !allowed[chapter]?.includes(id)) return false;
      const previous = this.tasks[chapter].size;
      this.tasks[chapter].add(id);
      return this.tasks[chapter].size !== previous;
    }
    ready() { return this.chapter < 3 && this.tasks[this.chapter].size === [3, 1, 3][this.chapter]; }
    choose(chapter, id) { if (chapter !== this.chapter || this.stage !== "explore" || !id) return false; this.choices[chapter] = id; return true; }
    openMemory() { if (this.stage !== "explore" || !this.ready()) return false; this.stage = "memory"; return true; }
    openGift() { if (this.stage !== "memory") return false; this.stage = "gift"; return true; }
    completeChapter() {
      if (this.stage !== "gift" || this.chapter >= 3) return false;
      this.stars.push(this.chapter); this.chapter++; this.stage = "explore"; return true;
    }
    finish() { if (this.chapter !== 3 || this.ended) return false; this.ended = true; return true; }
  }
  root.Journey = Journey;
  if (typeof module !== "undefined" && module.exports) module.exports = Journey;
})(typeof window === "undefined" ? globalThis : window);
