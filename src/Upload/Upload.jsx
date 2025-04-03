import { useAccountId } from "../hooks/useAccountId.js";
import Files from "react-files";
import { useCallback, useState } from "react";
import "./Upload.css";
import { encodeFfs } from "../hooks/fastfs.js";
import { Constants } from "../hooks/constants.js";

const Status = {
  Pending: "pending",
  Uploading: "uploading",
  Success: "success",
  Error: "error",
};

function clearHistory(obj) {
  for (const prop in obj) {
    if (obj.hasOwnProperty(prop)) {
      delete obj[prop];
    }
  }
}

async function transformFiles(relativePath, files) {
  relativePath = relativePath.replace(/^\//, "");
  const result = [];
  for (const file of files) {
    const data = await file.arrayBuffer();
    const encoded = new Uint8Array(data);
    result.push({
      status: Status.Pending,
      size: file.size,
      ffs: {
        simple: {
          relativePath: relativePath + file.name,
          content: {
            mimeType: file.type,
            content: encoded,
          },
        },
      },
    });
  }
  return result;
}

export function Upload(props) {
  const accountId = useAccountId();
  const [uploading, setUploading] = useState(false);
  const [relativePath, setRelativePath] = useState("/");
  const [files, setFiles] = useState([]);
  const [uploadingFiles, setUploadingFiles] = useState([]);

  const handleChange = (newFiles) => {
    setFiles((prevFiles) => [...prevFiles, ...newFiles]);
  };

  const startUpload = useCallback(
    async (files) => {
      await Promise.all(
        files.map(async (file) => {
          const ffs64 = encodeFfs(file.ffs);
          file.status = Status.Uploading;
          setUploadingFiles([...files]);
          clearHistory(near.localTxHistory());
          file.txId = await near.sendTx({
            receiverId: Constants.CONTRACT_ID,
            actions: [
              near.actions.functionCall({
                methodName: "__fastdata_fastfs",
                gas: "1",
                argsBase64: ffs64,
              }),
            ],
            waitUntil: "INCLUDED_FINAL",
          });
          file.status = Status.Success;
          file.url = `https://${accountId}.fastfs.io/${Constants.CONTRACT_ID}/${file.ffs.simple.relativePath}`;
          console.log("uploaded", file.txId);
          setUploadingFiles([...files]);
        })
      );
    },
    [accountId]
  );

  return (
    <div>
      <div className="mb-3 text-center">
        <h1>Upload to FastFS</h1>
      </div>
      <div className="mb-5">
        <h4>Step 1: Specify relative path (optional)</h4>
        <div>
          <input
            disabled={uploading}
            className="form-control"
            onChange={(e) => setRelativePath(e.target.value)}
            placeholder={"/"}
            value={relativePath}
          />
        </div>
      </div>

      <div className="mb-5">
        <h4>Step 2: Select Files to upload</h4>
        <div>
          <Files
            inputProps={{
              disabled: !!uploading,
            }}
            className="file-upload-zone"
            dragActiveClassName="file-upload-zone-active"
            onChange={handleChange}
            multiple
            maxFiles={10}
            maxFileSize={1_400_000}
            minFileSize={0}
            clickable
          >
            <div className="upload-content-wrapper">
              <p className="file-upload-text">
                Drop files here to start uploading
              </p>
              <p className="file-upload-subtext">or click to browse</p>
            </div>
          </Files>
        </div>
      </div>

      <div>
        <h4>Step 3: Upload</h4>
        <p>1.4MB per file</p>
        <div>
          <div className="mb-2">
            {files.map((file, index) => (
              <div key={`f-${index}`}>
                <code>{relativePath + file.name}</code>
                <code className="ms-2">{file.type}</code>
                <code className="ms-2">{file.size} bytes</code>
                <button
                  className="btn btn-outline-dark border-0"
                  title="remove"
                  onClick={() => {
                    setFiles((prevFiles) =>
                      prevFiles.filter((_, i) => i !== index)
                    );
                  }}
                >
                  ❌
                </button>
              </div>
            ))}
            {uploadingFiles.map((file, index) => (
              <div key={`up-${index}`}>
                {file.status === Status.Success ? (
                  <a href={file.url} target="_blank">
                    {file.url}
                  </a>
                ) : (
                  <>
                    <code>{file.ffs.simple.relativePath}</code>
                    <code className="ms-2">
                      {file.ffs.simple.content.mimeType}
                    </code>
                    <code className="ms-2">{file.size} bytes</code>
                    <span className="ms-2">{file.status}</span>
                  </>
                )}
              </div>
            ))}
          </div>

          <button
            disabled={uploading || files.length === 0}
            className="btn btn-primary btn-lg"
            onClick={async () => {
              setUploading(true);
              const uploadingFiles = await transformFiles(relativePath, files);
              setUploadingFiles(uploadingFiles);
              setFiles([]);
              await startUpload(uploadingFiles);
              setUploading(false);
            }}
          >
            Upload!
          </button>
        </div>
      </div>
    </div>
  );
}
