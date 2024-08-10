// stuff to upload files

var data = new Uint8Array([/* your data here */]);
var loc = "your_location";
var name = "your_name";

var formData = new FormData();
formData.append('file', new Blob([data], { type: 'application/octet-stream' }), 'filename.bin');
formData.append('loc', loc);
formData.append('name', name);

axios.post('/upload', formData, {
    headers: {
        'Content-Type': 'multipart/form-data'
    }
})
.then(function (response) {
    console.log('Data uploaded successfully');
})
.catch(function (error) {
    console.error('Error uploading data', error);
});