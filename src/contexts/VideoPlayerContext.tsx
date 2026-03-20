import React, { createContext, useCallback, useContext, useState } from "react";

interface VideoPlayerContextValue {
  activeVideoId: string | null;
  globalMuted: boolean;
  setActiveVideo: (id: string | null) => void;
  setGlobalMuted: (muted: boolean) => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | undefined>(undefined);

export const VideoPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [globalMuted, setGlobalMuted] = useState(true);

  const setActiveVideo = useCallback((id: string | null) => {
    setActiveVideoId(id);
  }, []);

  const handleSetGlobalMuted = useCallback((muted: boolean) => {
    setGlobalMuted(muted);
  }, []);

  return (
    <VideoPlayerContext.Provider
      value={{ activeVideoId, globalMuted, setActiveVideo, setGlobalMuted: handleSetGlobalMuted }}
    >
      {children}
    </VideoPlayerContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useVideoPlayer = () => {
  const context = useContext(VideoPlayerContext);
  if (context === undefined) throw new Error("useVideoPlayer must be used within a VideoPlayerProvider");
  return context;
};
