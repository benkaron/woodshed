export interface TrackInfo {
  id: string;
  title: string;
  duration: number;
  thumbnail: string;
}

export interface LoopRegion {
  id: string;
  name: string;
  start: number;
  end: number;
  color: string;
}

export interface BookmarkSet {
  trackId: string;
  loops: LoopRegion[];
}
