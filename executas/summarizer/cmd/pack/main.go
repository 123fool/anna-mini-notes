// pack builds a native Executa binary and an Anna-compatible distribution archive.
package main

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"time"

	"github.com/123fool/anna-mini-notes/executas/summarizer/internal/tool"
)

func main() {
	if err := pack(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

func pack() error {
	arch := runtime.GOARCH
	if arch == "amd64" {
		arch = "x86_64"
	}
	platform := runtime.GOOS + "-" + arch
	if platform != "windows-x86_64" && platform != "darwin-arm64" && platform != "darwin-x86_64" {
		return fmt.Errorf("unsupported release platform: %s", platform)
	}
	name := tool.Executable
	format := ".tar.gz"
	if runtime.GOOS == "windows" {
		name += ".exe"
		format = ".zip"
	}
	dist, err := filepath.Abs(filepath.Join("..", "..", "dist"))
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Join(dist, "bin"), 0755); err != nil {
		return err
	}
	executable := filepath.Join(dist, "bin", name)
	cmd := exec.Command("go", "build", "-trimpath", "-ldflags", "-s -w", "-o", executable, ".")
	cmd.Env = append(os.Environ(), "CGO_ENABLED=0")
	cmd.Stdout, cmd.Stderr = os.Stdout, os.Stderr
	if err := cmd.Run(); err != nil {
		return err
	}
	manifest, err := json.MarshalIndent(tool.Manifest(), "", "  ")
	if err != nil {
		return err
	}
	binary, err := os.ReadFile(executable)
	if err != nil {
		return err
	}
	entries := []struct {
		name string
		data []byte
		mode int64
	}{
		{"manifest.json", append(manifest, '\n'), 0644},
		{"bin/" + name, binary, 0755},
	}
	archive := filepath.Join(dist, tool.Executable+"-"+tool.Version+"-"+platform+format)
	file, err := os.Create(archive)
	if err != nil {
		return err
	}
	if format == ".zip" {
		writer := zip.NewWriter(file)
		for _, entry := range entries {
			header := &zip.FileHeader{Name: entry.name, Method: zip.Deflate}
			header.SetMode(os.FileMode(entry.mode))
			output, err := writer.CreateHeader(header)
			if err != nil {
				file.Close()
				return err
			}
			if _, err := output.Write(entry.data); err != nil {
				file.Close()
				return err
			}
		}
		if err := writer.Close(); err != nil {
			file.Close()
			return err
		}
	} else {
		compressed := gzip.NewWriter(file)
		writer := tar.NewWriter(compressed)
		for _, entry := range entries {
			if err := writer.WriteHeader(&tar.Header{Name: entry.name, Mode: entry.mode, Size: int64(len(entry.data)), ModTime: time.Unix(0, 0)}); err != nil {
				file.Close()
				return err
			}
			if _, err := writer.Write(entry.data); err != nil {
				file.Close()
				return err
			}
		}
		if err := writer.Close(); err != nil {
			file.Close()
			return err
		}
		if err := compressed.Close(); err != nil {
			file.Close()
			return err
		}
	}
	if err := file.Close(); err != nil {
		return err
	}
	f, err := os.Open(archive)
	if err != nil {
		return err
	}
	defer f.Close()
	hash := sha256.New()
	if _, err := io.Copy(hash, f); err != nil {
		return err
	}
	checksum := fmt.Sprintf("%x  %s\n", hash.Sum(nil), filepath.Base(archive))
	if err := os.WriteFile(archive+".sha256", []byte(checksum), 0644); err != nil {
		return err
	}
	fmt.Println(archive)
	return nil
}
