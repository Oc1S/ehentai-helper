export const Noise = () => {
  return (
    <div
      style={{
        backgroundImage: `url(${chrome.runtime.getURL('./noise.avif')})`,
        backgroundSize: '109px',
      }}
      className="pointer-events-none fixed inset-0 z-[9999999999] bg-repeat opacity-5"
    />
  );
};
